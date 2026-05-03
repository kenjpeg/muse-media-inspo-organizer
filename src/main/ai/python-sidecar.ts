import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

let sidecarProcess: ChildProcess | null = null;
let responseResolvers: Map<string, (value: unknown) => void> = new Map();
let requestId = 0;

function getVenvPython(): string {
  const projectRoot = path.resolve(__dirname, '../../..');
  return path.join(projectRoot, 'python', '.venv', 'bin', 'python3');
}

function getScriptPath(): string {
  const projectRoot = path.resolve(__dirname, '../../..');
  return path.join(projectRoot, 'python', 'embed_server.py');
}

export function startSidecar(): boolean {
  if (sidecarProcess) return true;

  const pythonPath = getVenvPython();
  const scriptPath = getScriptPath();

  try {
    sidecarProcess = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = readline.createInterface({ input: sidecarProcess.stdout! });
    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const resolver = responseResolvers.get(response.id);
        if (resolver) {
          resolver(response);
          responseResolvers.delete(response.id);
        }
      } catch {
        // Ignore non-JSON output
      }
    });

    sidecarProcess.on('exit', () => {
      sidecarProcess = null;
      responseResolvers.clear();
    });

    return true;
  } catch {
    return false;
  }
}

export function stopSidecar(): void {
  if (sidecarProcess) {
    sidecarProcess.kill();
    sidecarProcess = null;
    responseResolvers.clear();
  }
}

export function isSidecarRunning(): boolean {
  return sidecarProcess !== null && !sidecarProcess.killed;
}

function sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!sidecarProcess?.stdin) {
      reject(new Error('Sidecar not running'));
      return;
    }

    const id = String(++requestId);
    const request = JSON.stringify({ id, method, params }) + '\n';

    responseResolvers.set(id, resolve);
    sidecarProcess.stdin.write(request);

    setTimeout(() => {
      if (responseResolvers.has(id)) {
        responseResolvers.delete(id);
        reject(new Error('Sidecar request timeout'));
      }
    }, 60000);
  });
}

export async function getImageEmbedding(imagePath: string): Promise<number[] | null> {
  try {
    const response = await sendRequest('embed_image', { path: imagePath }) as { embedding?: number[] };
    return response.embedding ?? null;
  } catch {
    return null;
  }
}

export async function getTextEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await sendRequest('embed_text', { text }) as { embedding?: number[] };
    return response.embedding ?? null;
  } catch {
    return null;
  }
}
