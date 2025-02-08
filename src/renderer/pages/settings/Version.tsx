import { captureException } from '../../logging';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from 'renderer/components/Spinner';

interface IUpdateInfo {
  version: string;
  releaseNotes: string;
  releaseName: string;
  isDownloading: boolean;
}

export default function Version() {
  const { t } = useTranslation();

  const [updateInfo, setUpdateInfo] = useState<IUpdateInfo>();
  const [version, setVersion] = useState('0');

  useEffect(() => {
    let timer: NodeJS.Timer | null = null;
    let updateInfo = window.electron.store.get('updateInfo');
    setUpdateInfo(updateInfo);
    if (updateInfo?.isDownloading) {
      timer = setInterval(() => {
        updateInfo = window.electron.store.get('updateInfo');
        if (timer && !updateInfo?.isDownloading) {
          clearInterval(timer);
        }
        setUpdateInfo(updateInfo);
      }, 1000);

    }
    window.electron
      .getAppVersion()
      .then((appVersion) => {
        return setVersion(appVersion);
      })
      .catch((error: any) => {
        captureException(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t('Common.Version')}</div>
      <div className="py-5 flex-grow">
        <div>{version}</div>
        {updateInfo && (
          <div className="flex justify-start gap-2 items-center mt-2">
            {updateInfo?.isDownloading ? (
              <>
                <div>{t('Version.HasNewVersion')}</div>
                <div className="flex justify-start gap-1 items-center">
                  <Spinner size={16} />
                  <span className="tips">{t('Common.Downloading')}</span>
                </div>
              </>
            ) : (
              <div className='tips'>
                {updateInfo?.version} will be installed after you restart the
                app.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
