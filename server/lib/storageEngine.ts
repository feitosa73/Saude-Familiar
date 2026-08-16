import fs from 'fs';
import path from 'path';

export interface StorageData {
  users?: any[];
  families?: any[];
  familyMemberships?: any[];
  patients?: any[];
  medications?: any[];
  appointments?: any[];
  exams?: any[];
  documents?: any[];
  timelineEvents?: any[];
  accessRequests?: any[];
  familyInvitations?: any[];
  patientAccesses?: any[];
  [key: string]: any;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'saudefamiliar_db.json');

export class StorageEngine {
  private filePath: string;

  constructor(filePath = DEFAULT_DB_PATH) {
    this.filePath = filePath;
    this.ensureFileExists();
  }

  private ensureFileExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initialData: StorageData = {
        users: [],
        families: [],
        familyMemberships: [],
        patients: [],
        medications: [],
        appointments: [],
        exams: [],
        documents: [],
        timelineEvents: [],
        accessRequests: [],
        familyInvitations: [],
        patientAccesses: [],
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }

  public read(): StorageData {
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[StorageEngine] Erro ao ler arquivo ${this.filePath}:`, error);
      return {};
    }
  }

  public write(data: StorageData): void {
    try {
      this.ensureFileExists();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[StorageEngine] Erro ao escrever arquivo ${this.filePath}:`, error);
    }
  }

  public getCollection<T = any>(collectionName: keyof StorageData): T[] {
    const data = this.read();
    return (data[collectionName] as T[]) || [];
  }

  public setCollection<T = any>(collectionName: keyof StorageData, items: T[]): void {
    const data = this.read();
    data[collectionName] = items;
    this.write(data);
  }

  public findOne<T = any>(collectionName: keyof StorageData, predicate: (item: T) => boolean): T | null {
    const items = this.getCollection<T>(collectionName);
    return items.find(predicate) || null;
  }

  public findMany<T = any>(collectionName: keyof StorageData, predicate: (item: T) => boolean): T[] {
    const items = this.getCollection<T>(collectionName);
    return items.filter(predicate);
  }

  public saveItem<T extends { id?: string }>(collectionName: keyof StorageData, item: T): T {
    const items = this.getCollection<T>(collectionName);
    const index = items.findIndex((i: any) => i.id === item.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...item };
    } else {
      items.push(item);
    }
    this.setCollection(collectionName, items);
    return item;
  }

  public deleteItem(collectionName: keyof StorageData, id: string): boolean {
    const items = this.getCollection(collectionName);
    const filtered = items.filter((i: any) => i.id !== id);
    if (filtered.length !== items.length) {
      this.setCollection(collectionName, filtered);
      return true;
    }
    return false;
  }
}

export const storageEngine = new StorageEngine();
