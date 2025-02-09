import {
  DataGridBody,
  DataGrid,
  DataGridRow,
  DataGridHeader,
  DataGridCell,
  DataGridHeaderCell,
  RowRenderer,
} from '@fluentui-contrib/react-data-grid-react-window';
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  TableCell,
  TableCellActions,
  TableCellLayout,
  TableColumnDefinition,
  createTableColumn,
  useFluent,
  useScrollbarWidth,
} from '@fluentui/react-components';
import {
  bundleIcon,
  PinFilled,
  PinRegular,
  PinOffFilled,
  PinOffRegular,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
  OptionsFilled,
  OptionsRegular,
} from '@fluentui/react-icons';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import useNav from 'hooks/useNav';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from 'types/task';
import { fmtDateTime, unix2date, highlight, date2unix } from 'utils/util';
import useTaskStore from 'stores/useTaskStore';
import useToast from 'hooks/useToast';

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);
const OptionsIcon = bundleIcon(OptionsFilled, OptionsRegular);

interface Props {
  tasks: Task[];
  keyword?: string;
}

export default function TaskList({ tasks, keyword = '' }: Props) {
  console.log('TaskList received tasks:', tasks);

  const { t } = useTranslation();
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] = useState(false);
  const [innerHeight, setInnerHeight] = useState(window.innerHeight);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const { notifySuccess } = useToast();
  const navigate = useNav();

  const pinTask = (id: string) => {
    updateTask(id, { pinedAt: date2unix(new Date()) });
  };

  const unpinTask = (id: string) => {
    updateTask(id, { pinedAt: null });
  };

  useEffect(() => {
    const handleResize = () => setInnerHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const items = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        name: { value: task.name },
        frequency: {
          value: `${t(`Task.Frequency.${task.schedule.frequency}`)}${
            task.schedule.weekDay !== undefined
              ? ` (${t(`Common.WeekDay.${task.schedule.weekDay}`)})`
              : ''
          }`,
        },
        time: { value: task.schedule.time },
        updatedAt: {
          value: fmtDateTime(unix2date(parseInt(task.updatedAt))),
          timestamp: parseInt(task.updatedAt),
        },
        pined: !!task.pinedAt,
      })),
    [tasks, t]
  );

  type Item = {
    id: string;
    name: { value: string };
    frequency: { value: string };
    time: { value: string };
    updatedAt: { value: string; timestamp: number };
    pined: boolean;
  };

  const columns: TableColumnDefinition<Item>[] = [
    createTableColumn<Item>({
      columnId: 'name',
      compare: (a, b) => a.name.value.localeCompare(b.name.value),
      renderHeaderCell: () => t('Common.Name'),
      renderCell: (item) => (
        <TableCell>
          <TableCellLayout truncate>
            <div className="flex flex-start items-center">
              <div
                dangerouslySetInnerHTML={{
                  __html: highlight(item.name.value, keyword),
                }}
              />
              {item.pined ? <PinFilled className="ml-1" /> : null}
            </div>
          </TableCellLayout>
          <TableCellActions>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={<OptionsIcon />} appearance="subtle" />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<EditIcon />}
                    onClick={() => navigate(`/tasks/form/${item.id}`)}
                  >
                    {t('Common.Edit')}
                  </MenuItem>
                  <MenuItem
                    icon={<DeleteIcon />}
                    onClick={() => {
                      setActiveTaskId(item.id);
                      setDelConfirmDialogOpen(true);
                    }}
                  >
                    {t('Common.Delete')}
                  </MenuItem>
                  {item.pined ? (
                    <MenuItem
                      icon={<PinOffIcon />}
                      onClick={() => unpinTask(item.id)}
                    >
                      {t('Common.Unpin')}
                    </MenuItem>
                  ) : (
                    <MenuItem
                      icon={<PinIcon />}
                      onClick={() => pinTask(item.id)}
                    >
                      {t('Common.Pin')}
                    </MenuItem>
                  )}
                </MenuList>
              </MenuPopover>
            </Menu>
          </TableCellActions>
        </TableCell>
      ),
    }),
    createTableColumn<Item>({
      columnId: 'frequency',
      compare: (a, b) => a.frequency.value.localeCompare(b.frequency.value),
      renderHeaderCell: () => t('Task.Frequency'),
      renderCell: (item) => (
        <TableCellLayout>{item.frequency.value}</TableCellLayout>
      ),
    }),
    createTableColumn<Item>({
      columnId: 'time',
      compare: (a, b) => a.time.value.localeCompare(b.time.value),
      renderHeaderCell: () => t('Task.Time'),
      renderCell: (item) => <TableCellLayout>{item.time.value}</TableCellLayout>,
    }),
    createTableColumn<Item>({
      columnId: 'updatedAt',
      compare: (a, b) => b.updatedAt.timestamp - a.updatedAt.timestamp,
      renderHeaderCell: () => t('Common.LastUpdated'),
      renderCell: (item) => (
        <TableCellLayout>
          <span className="latin">{item.updatedAt.value}</span>
        </TableCellLayout>
      ),
    }),
  ];

  const renderRow: RowRenderer<Item> = ({ item, rowId }, style) => (
    <DataGridRow<Item> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );

  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full">
      <DataGrid
        items={items}
        columns={columns}
        focusMode="cell"
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => item.id}
      >
        <DataGridHeader style={{ paddingRight: scrollbarWidth }}>
          <DataGridRow>
            {({ renderHeaderCell }) => (
              <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<Item> itemSize={50} height={innerHeight - 140}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        onConfirm={() => {
          deleteTask(activeTaskId as string);
          setActiveTaskId(null);
          notifySuccess(t('Task.Notification.Deleted'));
        }}
      />
    </div>
  );
}
