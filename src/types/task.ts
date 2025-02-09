export type TaskFrequency = 'daily' | 'weekly' | 'monthly';

export interface TaskSchedule {
  frequency: TaskFrequency;
  time: string; // HH:mm format
  weekDay?: number; // 0-6 for weekly tasks
  dayOfMonth?: number; // 1-31 for monthly tasks
}

export interface Task {
  id: string;
  name: string;
  systemMessage: string;
  userMessage: string;
  promptTemplateId?: string;
  schedule: TaskSchedule;
  createdAt: string;
  updatedAt: string;
  pinedAt?: number | null;
}
