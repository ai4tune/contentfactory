# Content Factory Capture

Chrome extension prototype for importing the visible current page into local Content Factory.

## Install locally

1. Open Chrome and visit `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder:

```text
extensions/contentfactory-capture
```

## Use

1. Start Content Factory at `http://localhost:3000`.
2. Open a Xiaohongshu, WeChat article, Douyin, or other content page.
3. Click the extension.
4. Optionally enter the source keyword and account positioning.
5. Click "采集当前页面".

The extension only reads visible page text from the current browser tab. It does not store account passwords and does not bypass platform permissions.
