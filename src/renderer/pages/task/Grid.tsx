import { Task } from 'types/task';
import { Button } from '@fluentui/react-components';
import { Delete24Regular, Edit24Regular } from '@fluentui/react-icons';
import useNav from 'hooks/useNav';
import useTaskStore from 'stores/useTaskStore';
import { useTranslation } from 'react-i18next';

interface Props {
  tasks: Task[];
  keyword?: string;
}

export default function Grid({ tasks }: Props) {
  const { t } = useTranslation();
  const navigate = useNav();
  const deleteTask = useTaskStore((state) => state.deleteTask);

  return (
    <div className="grid gap-4">
      {tasks.map((task) => (
        <div key={task.id} className="p-4 border rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{task.name}</h3>
            <div className="flex gap-2">
              <Button
                icon={<Edit24Regular />}
                onClick={() => navigate(`/tasks/form/${task.id}`)}
              />
              <Button
                icon={<Delete24Regular />}
                onClick={() => deleteTask(task.id)}
              />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <div>Frequency: {task.schedule.frequency}</div>
            <div>Time: {task.schedule.time}</div>
            {task.schedule.weekDay !== undefined && (
              <div>Day: {t(`Common.WeekDay.${task.schedule.weekDay}`)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
