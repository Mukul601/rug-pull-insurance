import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Write JSON object to file with pretty formatting
 */
export function writeJson(filePath: string, obj: any): void {
  const jsonString = JSON.stringify(obj, null, 2);
  writeFileSync(filePath, jsonString, 'utf8');
}

/**
 * Read JSON file and parse it
 */
export function readJson(filePath: string): any {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Update or append a key=value line in an environment file
 */
export function setEnvLine(filePath: string, key: string, value: string): void {
  let content = '';
  
  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf8');
  }
  
  const lines = content.split('\n');
  const keyPattern = new RegExp(`^${key}=`);
  let found = false;
  
  // Update existing line or mark for append
  for (let i = 0; i < lines.length; i++) {
    if (keyPattern.test(lines[i])) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  
  // Append if not found
  if (!found) {
    lines.push(`${key}=${value}`);
  }
  
  // Ensure file ends with newline
  const result = lines.join('\n');
  const finalContent = result.endsWith('\n') ? result : result + '\n';
  
  writeFileSync(filePath, finalContent, 'utf8');
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Read file content as string
 */
export function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

/**
 * Write string content to file
 */
export function writeFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf8');
}
