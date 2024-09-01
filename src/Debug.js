import { StorageManager } from "./storage/StorageManager";

export class Debug {
  static debugPanel = null;
  static isVisible = false;
  static isDragging = false;
  static messages = {};

  static init() {
    if (!Debug.debugPanel) {
      Debug.debugPanel = document.createElement('div');
      Debug.debugPanel.id = 'debug-panel';
      Debug.debugPanel.style.display = 'none';
      Debug.debugPanel.style.position = 'fixed';
      Debug.debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      Debug.debugPanel.style.color = 'white';
      Debug.debugPanel.style.padding = '10px';
      Debug.debugPanel.style.borderRadius = '5px';
      Debug.debugPanel.style.zIndex = '99999999';
      Debug.debugPanel.style.maxWidth = '300px';
      Debug.debugPanel.style.fontFamily = 'Helvetica, Arial, sans-serif';
      Debug.debugPanel.style.fontSize = '14px';
      Debug.debugPanel.style.height = 'auto';
      Debug.debugPanel.style.right = '10px';
      Debug.debugPanel.style.top = '10px';
      Debug.debugPanel.style.cursor = 'grab';

      document.body.appendChild(Debug.debugPanel);
      Debug.#initDrag();
    }
  }

  static toggleVisibility() {
    Debug.isVisible = !Debug.isVisible;
    Debug.debugPanel.style.display = Debug.isVisible ? 'block' : 'none';
  }

  static setVisible(state) {
    if (Object.keys(Debug.messages).length === 0) {
        Debug.setMessage("Debug mode enabled. You can drag this panel freely. Type SET DEBUG 0 to disable.");
    }
    Debug.isVisible = state;
    Debug.debugPanel.style.display = state ? 'block' : 'none';
  }

  static updateMessage(tag, content) {
    if (typeof content === 'string') {
      Debug.messages[tag] = content;
    } else {
      Debug.messages[tag] = String(content);
    }
    Debug.renderMessages();
  }

  static clearMessage(tag) {
    delete Debug.messages[tag];
    Debug.renderMessages();
  }

  static clearMessages() {
    Debug.messages = {};
    Debug.renderMessages();
  }

  static setMessage(content) {
    Debug.messages = {};

    Debug.debugPanel.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = content;
    p.style.margin = '5px 0';
    Debug.debugPanel.appendChild(p);

    Debug.debugPanel.style.display = 'block';
    Debug.isVisible = true;
  }

  static renderMessages() {
    const sortedTags = Object.keys(Debug.messages).sort();
    Debug.debugPanel.innerHTML = '';

    sortedTags.forEach(tag => {
      const p = document.createElement('p');
      p.textContent = Debug.messages[tag];
      p.style.margin = '5px 0';
      Debug.debugPanel.appendChild(p);
    });

    if (sortedTags.length > 0) {
      Debug.debugPanel.style.display = 'block';
      Debug.isVisible = true;
    } else {
      Debug.debugPanel.style.display = 'none';
      Debug.isVisible = false;
    }
  }

  static isEnabled() {
    return StorageManager.getValue("DEBUG") == "1";
  }

  static #initDrag() {
    Debug.debugPanel.addEventListener('touchstart', (e) => {
      Debug.isDragging = true;
      Debug.startX = e.touches[0].clientX;
      Debug.startY = e.touches[0].clientY;
      Debug.initialX = Debug.debugPanel.offsetLeft;
      Debug.initialY = Debug.debugPanel.offsetTop;
    });

    Debug.debugPanel.addEventListener('touchmove', (e) => {
      if (Debug.isDragging) {
        let dx = e.touches[0].clientX - Debug.startX;
        let dy = e.touches[0].clientY - Debug.startY;
        Debug.debugPanel.style.left = Debug.initialX + dx + 'px';
        Debug.debugPanel.style.top = Debug.initialY + dy + 'px';
      }
    });

    Debug.debugPanel.addEventListener('touchend', () => {
      Debug.isDragging = false;
    });

    Debug.debugPanel.addEventListener('mousedown', (e) => {
      Debug.isDragging = true;
      Debug.startX = e.clientX;
      Debug.startY = e.clientY;
      Debug.initialX = Debug.debugPanel.offsetLeft;
      Debug.initialY = Debug.debugPanel.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (Debug.isDragging) {
        let dx = e.clientX - Debug.startX;
        let dy = e.clientY - Debug.startY;
        Debug.debugPanel.style.left = Debug.initialX + dx + 'px';
        Debug.debugPanel.style.top = Debug.initialY + dy + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      Debug.isDragging = false;
    });
  }
}

Debug.init();