import React from 'react';
import { FolderPlus } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

interface WelcomeScreenProps {
  onSelectStorage: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectStorage }) => {
  const { t } = useI18n();

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">📝</div>
        <h1 className="welcome-title">{t('welcome.title')}</h1>
        <p className="welcome-description">
          {t('welcome.description')}
        </p>
        <button className="btn btn-primary welcome-btn" onClick={onSelectStorage}>
          <FolderPlus size={18} />
          {t('welcome.selectStorage')}
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;