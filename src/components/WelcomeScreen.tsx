import React from 'react';
import { FolderPlus } from 'lucide-react';

interface WelcomeScreenProps {
  onSelectStorage: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectStorage }) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">📝</div>
        <h1 className="welcome-title">欢迎使用 TinyNote</h1>
        <p className="welcome-description">
          轻量级笔记管理与快捷复制工具。在空间、分组和笔记本中组织你的命令、代码片段和笔记。
        </p>
        <button className="btn btn-primary welcome-btn" onClick={onSelectStorage}>
          <FolderPlus size={18} />
          选择存储文件夹
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;