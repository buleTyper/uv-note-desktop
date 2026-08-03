import { useState, useEffect } from 'react';

// 定义一条笔记的数据结构类型
interface NoteItem {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const [inputText, setInputText] = useState('');

  // 1. 初始化 State：读取本地存储的对象数组
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const savedNotes = localStorage.getItem('uv_notes_v2');
    return savedNotes
      ? JSON.parse(savedNotes)
      : [
          { id: 1, text: '学习 React 数组响应式', completed: true },
          { id: 2, text: '给 uv-note 增加完成勾选功能', completed: false },
        ];
  });

  // 2. 自动化落盘保存
  useEffect(() => {
    localStorage.setItem('uv_notes_v2', JSON.stringify(notes));
  }, [notes]);

  // 3. 添加笔记（生成带有 id 和 completed 的新对象）
  function handleAddNote() {
    if (inputText.trim() === '') return;

    const newNote: NoteItem = {
      id: Date.now(), // 用当前毫秒时间戳作为唯一的 id
      text: inputText,
      completed: false, // 默认未完成
    };

    setNotes([...notes, newNote]);
    setInputText('');
  }

  // 4. 删除笔记（根据唯一的 id 来删除）
  function handleDeleteNote(idToDelete: number) {
    setNotes(notes.filter((item) => item.id !== idToDelete));
  }

  // 5. 💡 重点：切换笔记的完成/未完成状态
  function handleToggleComplete(targetId: number) {
    const updatedNotes = notes.map((item) => {
      if (item.id === targetId) {
        // 如果是我们要修改的那一条，创建一个新对象，把 completed 取反 (!item.completed)
        return { ...item, completed: !item.completed };
      }
      // 其他不相关的笔记，原样返回
      return item;
    });

    setNotes(updatedNotes);
  }

  return (
    <div style={{ padding: '30px', maxWidth: '500px' }}>
      <h2>📔 我的 uv-note 极简笔记</h2>

      {/* 输入区域 */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="输入新笔记..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{ padding: '8px', width: '250px', fontSize: '14px' }}
        />
        <button
          onClick={handleAddNote}
          style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer' }}
        >
          添加笔记
        </button>
      </div>

      {/* 列表渲染 */}
      <h3>笔记列表（共 {notes.length} 条）：</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {notes.map((item) => (
          <li
            key={item.id} // 💡 注意：这里用唯一的 item.id 作为 key，比 index 更安全！
            style={{
              padding: '8px 0',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* 复选框：勾选状态绑定 item.completed */}
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggleComplete(item.id)}
              style={{ marginRight: '10px', cursor: 'pointer' }}
            />

            {/* 笔记文字：如果已完成，加上划线特效 */}
            <span
              style={{
                textDecoration: item.completed ? 'line-through' : 'none',
                color: item.completed ? '#888' : '#000',
                flexGrow: 1,
              }}
            >
              📄 {item.text}
            </span>

            {/* 删除按钮 */}
            <button
              onClick={() => handleDeleteNote(item.id)}
              style={{ color: 'red', cursor: 'pointer' }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}