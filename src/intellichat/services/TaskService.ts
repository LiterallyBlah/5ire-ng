import { Task } from 'types/task';
import Debug from 'debug';
import { typeid } from 'typeid-js';
import { IChat } from 'intellichat/types';
import { BrowserWindow, Notification } from 'electron';

const debug = Debug('5ire:services:TaskService');

export class TaskService {
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private timezoneOffset: number;
  private taskQueue: Task[] = [];
  
  constructor() {
    this.timezoneOffset = new Date().getTimezoneOffset();
    this.initializeScheduler();
    console.log('[TaskService] Initialized with timezone offset:', this.timezoneOffset);
  }

  // Make executeTask public so it can be called from IPC handlers
  public async executeTask(task: Task) {
    console.log(`[TaskService] Executing task ${task.id} at ${new Date().toISOString()}`);

    try {
      // Create a new chat for this task via IPC
      const chatId = typeid('chat').toString();
      const model = await window.electron.settings.get('api.model') || 'gpt-3.5-turbo'; // ✅ Await settings.get()
      
      const chat: IChat = {
        id: chatId,
        summary: `[Task] ${task.name}`,
        model, // Now it's correctly a string
        systemMessage: task.systemMessage,
        createdAt: Math.floor(Date.now() / 1000),
      };
    
      // Use IPC to communicate with main process for database operations
      await window.electron.tasks.createTaskChat(chat);
      await window.electron.tasks.createTaskMessage({
        id: typeid('msg').toString(),
        chatId,
        prompt: task.userMessage,
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000)
      });
      
      

      console.log(`[TaskService] Task ${task.id} execution completed, chat ${chatId} created`);
      
      // Notify main process of completion
      await window.electron.tasks.notifyCompletion({
        taskId: task.id,
        chatId: chatId,
        name: task.name
      });

    } catch (error) {
      console.error(`[TaskService] Failed to execute task ${task.id}:`, error);
      await window.electron.tasks.notifyError({
        taskId: task.id,
        name: task.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
    console.log('[TaskService] Main window reference set');
    
    // Process any queued tasks if they exist
    if (this.taskQueue.length > 0) {
      console.log(`[TaskService] Processing ${this.taskQueue.length} queued tasks`);
      this.taskQueue.forEach(task => this.executeTask(task));
      this.taskQueue = [];
    }
  }

  private initializeScheduler() {
    console.log('[TaskService] Initializing scheduler, clearing existing tasks');
    this.scheduledTasks.forEach(timeout => clearTimeout(timeout));
    this.scheduledTasks.clear();
  }

  public scheduleTask(task: Task) {
    console.log(`[TaskService] Attempting to schedule task ${task.id}:`, task);
    const nextRunTime = this.calculateNextRunTime(task.schedule);
    if (!nextRunTime) {
      console.log(`[TaskService] Failed to calculate next run time for task ${task.id}`);
      return;
    }

    const timeUntilRun = nextRunTime.getTime() - Date.now();
    if (timeUntilRun <= 0) {
      console.log(`[TaskService] Task ${task.id} scheduled time ${nextRunTime.toISOString()} is in the past, rescheduling for next occurrence`);
      // Try scheduling for next occurrence
      const nextDay = new Date(nextRunTime);
      nextDay.setDate(nextDay.getDate() + 1);
      this.scheduleTask({
        ...task,
        schedule: {
          ...task.schedule,
          time: task.schedule.time // Keep same time
        }
      });
      return;
    }

    console.log(`[TaskService] Scheduling task ${task.id} to run at ${nextRunTime.toISOString()} (in ${Math.round(timeUntilRun/1000/60)} minutes)`);
    
    const timeout = setTimeout(() => {
      console.log(`[TaskService] Executing scheduled task ${task.id} at ${new Date().toISOString()}`);
      this.executeTask(task).catch(err => {
        console.error(`[TaskService] Failed to execute task ${task.id}:`, err);
      });
      // Schedule next run after execution
      this.scheduleNextRun(task);
    }, timeUntilRun);

    this.scheduledTasks.set(task.id, timeout);
    console.log(`[TaskService] Currently scheduled tasks: ${Array.from(this.scheduledTasks.keys()).join(', ')}`);
  }

  private scheduleNextRun(task: Task) {
    // Calculate next run based on frequency
    const now = new Date();
    let nextRun: Date | null = null;

    switch (task.schedule.frequency) {
      case 'daily':
        nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 1);
        break;

      case 'weekly':
        nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 7);
        break;

      case 'monthly':
        nextRun = new Date(now);
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }

    if (nextRun) {
      console.log(`[TaskService] Scheduling next run for task ${task.id} at ${nextRun.toISOString()}`);
      this.scheduleTask(task);
    }
  }

  private calculateNextRunTime(schedule: Task['schedule']): Date | null {
    const now = new Date();
    console.log(`[TaskService] Calculating next run time for schedule:`, schedule);
    console.log(`[TaskService] Current time:`, now.toISOString());

    // Parse schedule time in local timezone
    const [hours, minutes] = schedule.time.split(':').map(Number);
    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // Adjust for timezone
    nextRun = new Date(nextRun.getTime() - (this.timezoneOffset * 60 * 1000));
    
    console.log(`[TaskService] Initial next run time:`, nextRun.toISOString());

    // If the time today has passed, move to next occurrence
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
      console.log(`[TaskService] Time today has passed, moved to tomorrow:`, nextRun.toISOString());
    }

    switch (schedule.frequency) {
      case 'daily':
        console.log(`[TaskService] Daily task, using calculated time:`, nextRun.toISOString());
        return nextRun;

      case 'weekly':
        if (typeof schedule.weekDay !== 'number') {
          console.log('[TaskService] Weekly task missing weekDay');
          return null;
        }
        while (nextRun.getDay() !== schedule.weekDay) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        console.log(`[TaskService] Weekly task, adjusted to weekday ${schedule.weekDay}:`, nextRun.toISOString());
        return nextRun;

      case 'monthly':
        if (typeof schedule.dayOfMonth !== 'number') {
          console.log('[TaskService] Monthly task missing dayOfMonth');
          return null;
        }
        nextRun.setDate(schedule.dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          console.log(`[TaskService] Monthly task, moved to next month:`, nextRun.toISOString());
        }
        console.log(`[TaskService] Monthly task final time:`, nextRun.toISOString());
        return nextRun;

      default:
        console.log(`[TaskService] Invalid frequency: ${schedule.frequency}`);
        return null;
    }
  }

  public stopTask(taskId: string) {
    console.log(`[TaskService] Stopping task ${taskId}`);
    const timeout = this.scheduledTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTasks.delete(taskId);
      console.log(`[TaskService] Stopped scheduling for task ${taskId}`);
      console.log(`[TaskService] Currently scheduled tasks: ${Array.from(this.scheduledTasks.keys()).join(', ')}`);
    } else {
      console.log(`[TaskService] No scheduled timeout found for task ${taskId}`);
    }
  }
}