import { create } from 'zustand';
import { Task, TaskSchedule, TaskFrequency } from 'types/task';
import { date2unix } from 'utils/util';

interface TaskStore {
  tasks: Task[];
  createTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (id: string, task: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  fetchTasks: (params?: { keyword?: string }) => Promise<void>;
  getTask: (id: string) => Promise<Task>;
}

interface DBTaskRow {
  id: string;
  name: string;
  systemMessage: string;
  userMessage: string;
  promptTemplateId: string | null;
  frequency: TaskFrequency;
  time: string;
  weekDay: number | null;
  dayOfMonth: number | null;
  createdAt: number;
  updatedAt: number;
  promptName?: string;
  pinedAt: number | null;
}

const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],

  async createTask(task) {
    const now = date2unix(new Date());
    const newTask: Task = {
      id: crypto.randomUUID(),
      name: task.name || '',
      systemMessage: task.systemMessage || '',
      userMessage: task.userMessage || '',
      promptTemplateId: task.promptTemplateId,
      schedule: task.schedule || {
        frequency: 'daily',
        time: '09:00'
      },
      createdAt: now.toString(),
      updatedAt: now.toString(),
    };

    console.log('Creating task:', newTask);

    const ok = await window.electron.db.run(
      `INSERT INTO tasks (
        id, name, systemMessage, userMessage, promptTemplateId,
        frequency, time, weekDay, dayOfMonth, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTask.id,
        newTask.name,
        newTask.systemMessage,
        newTask.userMessage,
        newTask.promptTemplateId,
        newTask.schedule.frequency,
        newTask.schedule.time,
        newTask.schedule.weekDay,
        newTask.schedule.dayOfMonth,
        newTask.createdAt,
        newTask.updatedAt,
      ]
    );

    if (!ok) {
      console.error('Failed to create task');
      throw new Error('Failed to create task');
    }

    console.log('Task created successfully');
    set((state) => ({ tasks: [...state.tasks, newTask] }));
  },

  async updateTask(id, taskUpdate) {
    const updates: string[] = [];
    const values: any[] = [];

    if (taskUpdate.name) {
      updates.push('name = ?');
      values.push(taskUpdate.name);
    }
    if (taskUpdate.systemMessage !== undefined) {
      updates.push('systemMessage = ?');
      values.push(taskUpdate.systemMessage);
    }
    if (taskUpdate.userMessage !== undefined) {
      updates.push('userMessage = ?');
      values.push(taskUpdate.userMessage);
    }
    if (taskUpdate.promptTemplateId !== undefined) {
      updates.push('promptTemplateId = ?');
      values.push(taskUpdate.promptTemplateId);
    }
    if (taskUpdate.schedule) {
      if (taskUpdate.schedule.frequency) {
        updates.push('frequency = ?');
        values.push(taskUpdate.schedule.frequency);
      }
      if (taskUpdate.schedule.time) {
        updates.push('time = ?');
        values.push(taskUpdate.schedule.time);
      }
      if (taskUpdate.schedule.weekDay !== undefined) {
        updates.push('weekDay = ?');
        values.push(taskUpdate.schedule.weekDay);
      }
      if (taskUpdate.schedule.dayOfMonth !== undefined) {
        updates.push('dayOfMonth = ?');
        values.push(taskUpdate.schedule.dayOfMonth);
      }
    }

    if (updates.length) {
      updates.push('updatedAt = ?');
      values.push(date2unix(new Date()));
      values.push(id);

      const ok = await window.electron.db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (!ok) {
        throw new Error('Failed to update task');
      }

      set(state => ({
        tasks: state.tasks.map(task =>
          task.id === id
            ? { ...task, ...taskUpdate, updatedAt: new Date().toISOString() }
            : task
        )
      }));
    }
  },

  async deleteTask(id) {
    const ok = await window.electron.db.run(
      `DELETE FROM tasks WHERE id = ?`,
      [id]
    );

    if (!ok) {
      throw new Error('Failed to delete task');
    }

    set(state => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
  },

  async fetchTasks({ keyword = '' } = {}) {
    console.log('Fetching tasks with keyword:', keyword);
    
    try {
      // Check database connection
      const dbCheck = await window.electron.db.run('SELECT 1', []);
      console.log('Database connection check:', dbCheck);

      if (!dbCheck) {
        throw new Error('Database connection failed');
      }

      const query = `
        SELECT t.*, p.name as promptName 
        FROM tasks t
        LEFT JOIN prompts p ON t.promptTemplateId = p.id
        ${keyword ? 'WHERE t.name LIKE ?' : ''}
        ORDER BY CASE WHEN t.pinedAt IS NULL THEN 1 ELSE 0 END, t.pinedAt DESC, t.updatedAt DESC
      `;
      const params = keyword ? [`%${keyword}%`] : [];
      
      console.log('Executing query:', query);
      console.log('Query parameters:', params);

      const results = await window.electron.db.all<DBTaskRow>(query, params);
      
      console.log('Raw results from database:', results);

      if (results === undefined) {
        throw new Error('Query returned undefined results');
      }

      if (!Array.isArray(results)) {
        throw new Error(`Unexpected results format: ${typeof results}`);
      }

      const tasks = results.map((row: DBTaskRow) => ({
        id: row.id,
        name: row.name,
        systemMessage: row.systemMessage,
        userMessage: row.userMessage,
        promptTemplateId: row.promptTemplateId || undefined,
        schedule: {
          frequency: row.frequency,
          time: row.time,
          weekDay: row.weekDay || undefined,
          dayOfMonth: row.dayOfMonth || undefined,
        },
        createdAt: row.createdAt.toString(),
        updatedAt: row.updatedAt.toString(),
        pinedAt: row.pinedAt,
      }));

      // Only update state if tasks have changed
      if (JSON.stringify(tasks) !== JSON.stringify(get().tasks)) {
        set({ tasks });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      set({ tasks: [] });
      throw error; // Re-throw the error to be caught by the component
    }
  },

  async getTask(id: string) {
    const existingTask = get().tasks.find(task => task.id === id);
    if (existingTask) {
      return existingTask;
    }

    const result = await window.electron.db.get<DBTaskRow>(
      `SELECT t.*, p.name as promptName 
      FROM tasks t
      LEFT JOIN prompts p ON t.promptTemplateId = p.id
      WHERE t.id = ?`,
      id
    );

    if (!result) {
      throw new Error('Task not found');
    }

    const task: Task = {
      id: result.id,
      name: result.name,
      systemMessage: result.systemMessage,
      userMessage: result.userMessage,
      promptTemplateId: result.promptTemplateId || undefined,
      schedule: {
        frequency: result.frequency,
        time: result.time,
        weekDay: result.weekDay || undefined,
        dayOfMonth: result.dayOfMonth || undefined,
      },
      createdAt: result.createdAt.toString(),
      updatedAt: result.updatedAt.toString(),
      pinedAt: result.pinedAt,
    };

    return task;
  },
}));

export default useTaskStore;
