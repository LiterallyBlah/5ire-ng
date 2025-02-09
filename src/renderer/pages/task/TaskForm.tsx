import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useTaskStore from 'stores/useTaskStore';
import usePromptStore from 'stores/usePromptStore';
import { Task, TaskFrequency } from 'types/task';
import {
  Button,
  Field,
  Input,
  Dropdown,
  Option,
  Text,
  Textarea,
  InputOnChangeData,
  InfoLabel,
} from '@fluentui/react-components';
import useToast from 'hooks/useToast';
import { isBlank } from 'utils/validators';

function MessageField({
  label,
  tooltip,
  value,
  onChange,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field
      label={tooltip ? <InfoLabel info={tooltip}>{label}</InfoLabel> : label}
    >
      <Textarea
        resize="vertical"
        style={{ minHeight: 180 }}
        value={value}
        onChange={onChange}
      />
    </Field>
  );
}

export default function TaskForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
  
  const initialTask: Partial<Task> = {
    name: '',
    systemMessage: '',
    userMessage: '',
    schedule: {
      frequency: 'daily' as TaskFrequency,
      time: '09:00'
    }
  };

  const [task, setTask] = useState<Partial<Task>>(initialTask);
  const [isLoaded, setIsLoaded] = useState(false);
  const [usePromptTemplate, setUsePromptTemplate] = useState(false);
  
  const prompts = usePromptStore((state) => state.prompts);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const getTask = useTaskStore((state) => state.getTask);

  useEffect(() => {
    let mounted = true;

    if (id && !isLoaded) {
      getTask(id)
        .then((loadedTask) => {
          if (mounted) {
            setTask(loadedTask);
            setIsLoaded(true);
            setUsePromptTemplate(!!loadedTask.promptTemplateId);
          }
        })
        .catch((error) => {
          if (mounted) {
            notifyError(t('Task.Notifications.TaskNotFound'));
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [id, getTask, notifyError, t]);

  const handleSubmit = async () => {
    if (isBlank(task.name) || (!task.promptTemplateId && isBlank(task.systemMessage))) {
      notifyError(t('Task.Notifications.NameAndMessageRequired'));
      return;
    }

    try {
      if (id) {
        await updateTask(id, task);
        notifySuccess(t('Task.Notifications.TaskUpdated'));
      } else {
        await createTask(task as Task);
        notifySuccess(t('Task.Notifications.TaskCreated'));
      }
      navigate('/tasks');
    } catch (error) {
      notifyError(t('Task.Notifications.TaskSaveFailed'));
    }
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between">
        <h1 className="text-2xl">{id ? t('Task.EditTask') : t('Task.CreateTask')}</h1>
        <div className="flex items-center gap-2">
          <Button appearance="subtle" onClick={() => navigate('/tasks')}>
            {t('Common.Cancel')}
          </Button>
          <Button appearance="primary" onClick={handleSubmit}>
            {t('Common.Save')}
          </Button>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        <div className="mr-5 flex flex-col gap-4">
          <Field label={t('Common.Name')}>
            <Input
              value={task.name}
              onChange={(e, data) => {
                setTask(prev => ({ ...prev, name: data.value }));
              }}
              placeholder={t('Common.Required')}
            />
          </Field>

          <Field>
            <input
              type="checkbox"
              id="usePromptTemplate"
              checked={usePromptTemplate}
              onChange={(e) => {
                setUsePromptTemplate(e.target.checked);
              }}
            />
            <label htmlFor="usePromptTemplate">{t('Task.UsePromptTemplate')}</label>
          </Field>

          {usePromptTemplate && (
            <Field label={t('Task.PromptTemplate')}>
              <Dropdown
                value={task.promptTemplateId}
                onOptionSelect={(_, data) => {
                  setTask(prev => ({ ...prev, promptTemplateId: data.optionValue as string }));
                }}
              >
                {prompts.map(prompt => (
                  <Option key={prompt.id} value={prompt.id}>{prompt.name}</Option>
                ))}
              </Dropdown>
            </Field>
          )}

          {!usePromptTemplate && (
            <>
              <MessageField
                label={t('Task.SystemMessage')}
                tooltip={t('Tooltip.SystemMessage')}
                value={task.systemMessage || ''}
                onChange={(e) => {
                  setTask(prev => ({ ...prev, systemMessage: e.target.value }));
                }}
              />
              <MessageField
                label={t('Task.UserMessage')}
                value={task.userMessage || ''}
                onChange={(e) => {
                  setTask(prev => ({ ...prev, userMessage: e.target.value }));
                }}
              />
            </>
          )}

          <Field label={t('Task.Frequency')}>
            <Dropdown
              value={task.schedule?.frequency}
              onOptionSelect={(_, data) => {
                setTask(prev => ({
                  ...prev,
                  schedule: {
                    ...prev.schedule!,
                    frequency: data.optionValue as TaskFrequency
                  }
                }));
              }}
            >
              <Option value="daily">{t('Task.Frequency.Daily')}</Option>
              <Option value="weekly">{t('Task.Frequency.Weekly')}</Option>
              <Option value="monthly">{t('Task.Frequency.Monthly')}</Option>
            </Dropdown>
          </Field>

          {task.schedule?.frequency === 'weekly' && (
            <Field label={t('Task.WeekDay')}>
              <Dropdown
                value={task.schedule.weekDay?.toString()}
                onOptionSelect={(_, data) => {
                  setTask(prev => ({
                    ...prev,
                    schedule: {
                      ...prev.schedule!,
                      weekDay: parseInt(data.optionValue as string)
                    }
                  }));
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <Option key={day} value={day.toString()}>
                    {t(`Common.WeekDay.${day}`)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}

          <Field label={t('Task.Time')}>
            <Input
              type="time"
              value={task.schedule?.time}
              onChange={(e, data) => {
                setTask(prev => ({
                  ...prev,
                  schedule: { ...prev.schedule!, time: data.value }
                }));
              }}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
