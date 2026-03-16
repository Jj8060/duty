import { createDefaultGroups } from "./mockData";
import { MemoryDriver, SupabaseDriver } from "./storage";
import type { StorageDriver } from "./storage";
import type { Group } from "./types";

const defaultGroups: Group[] = createDefaultGroups();

// 单例：确保整个应用复用同一份内存数据/连接
const supabaseDriver = new SupabaseDriver();
const memoryDriver = new MemoryDriver(defaultGroups);

export const driver: StorageDriver = supabaseDriver.isReady() ? supabaseDriver : memoryDriver;
export const groups = defaultGroups;

