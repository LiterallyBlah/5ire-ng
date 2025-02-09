import { Input, Button, InputOnChangeData } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import useNav from 'hooks/useNav';
import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import useTaskStore from 'stores/useTaskStore';
import TaskList from './TaskList';
import useToast from 'hooks/useToast';

export default function Tasks() {
  const { t } = useTranslation();
  const navigate = useNav();
  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const [keyword, setKeyword] = useState<string>('');
  const { notifyError } = useToast();

  const fetchTasksWithError = useCallback(async () => {
    try {
      await fetchTasks({ keyword });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      notifyError(t('Task.Notifications.FetchError'));
    }
  }, [fetchTasks, keyword, notifyError, t]);

  useEffect(() => {
    fetchTasksWithError();
  }, [fetchTasksWithError]);

  const onKeywordChange = useCallback((
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setKeyword(data.value || '');
  }, []);

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Tasks')}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button appearance="primary" onClick={() => navigate('/tasks/form')}>
              {t('Common.New')}
            </Button>
            <Input
              contentBefore={<Search24Regular />}
              placeholder={t('Common.Search')}
              value={keyword}
              onChange={onKeywordChange}
              style={{ maxWidth: 288 }}
              className="flex-grow flex-shrink"
            />
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {tasks.length ? (
          <div className="mr-5">
            <TaskList tasks={tasks} keyword={keyword} />
          </div>
        ) : (
          <Empty image="design" text={t('Task.Info.Empty')} />
        )}
      </div>
    </div>
  );
}
