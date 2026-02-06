# Yandex Cloud Function Proxy для Supabase Edge Functions

## Архитектура

```
[Клиент] → [Yandex Cloud Function] → [Supabase Edge Functions]
                                      ├── db-proxy (база данных)
                                      └── storage-proxy (файлы)
```

## 1. Создайте функцию в Yandex Cloud Console

1. Перейдите в [Yandex Cloud Console](https://console.yandex.cloud/)
2. Создайте новую Cloud Function
3. Выберите runtime: **Node.js 18**
4. Скопируйте код ниже

## 2. Код функции (index.js)

```javascript
const https = require('https');

const SUPABASE_HOST = 'kstfczzkskpmsswmanif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdGZjenprc2twbXNzd21hbmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzQyNzQsImV4cCI6MjA4MTgxMDI3NH0.jWLsKT6coHb0-RQNnpqFnhMTH2AVOq-GMsHTkRLI2ro';

module.exports.handler = async function (event, context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        
        // Determine target edge function based on request
        // Default to db-proxy, use storage-proxy if _proxyTarget is set
        const proxyTarget = body._proxyTarget || 'db-proxy';
        delete body._proxyTarget; // Remove meta field before forwarding
        
        const path = `/functions/v1/${proxyTarget}`;
        
        const response = await new Promise((resolve, reject) => {
            const options = {
                hostname: SUPABASE_HOST,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                timeout: 30000,
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        body: data,
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.write(JSON.stringify(body));
            req.end();
        });

        return {
            statusCode: response.statusCode,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
            body: response.body,
        };
    } catch (error) {
        console.error('Proxy error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
```

## 3. Настройки функции

- **Таймаут**: 30 секунд
- **Память**: 128 MB (достаточно)
- **Публичный доступ**: Включить (сделать функцию публичной)

## 4. Получите URL функции

После создания вы получите URL вида:
```
https://functions.yandexcloud.net/d4e...abc
```

## 5. Поддерживаемые операции

Прокси поддерживает **любые** edge-функции через `_proxyTarget`. По умолчанию запросы идут в `db-proxy`.

### База данных (db-proxy) — по умолчанию
- `select` — выборка данных
- `insert` — вставка записей
- `update` — обновление записей
- `delete` — удаление записей
- `upsert` — вставка или обновление
- `ping` — проверка связи

### Хранилище файлов (storage-proxy)
`_proxyTarget: "storage-proxy"`

- `upload` — загрузка файла (base64)
- `download` — скачивание файла (возвращает base64)
- `delete` — удаление файлов
- `getPublicUrl` — получение публичной ссылки
- `list` — список файлов в папке

### Загрузка файлов в чат (yandex-s3-upload)
`_proxyTarget: "yandex-s3-upload"`

- Загрузка файлов в Yandex Object Storage (S3)
- Принимает: `fileName`, `fileBase64`, `contentType`

### Проксирование аватаров (avatar-proxy)
`_proxyTarget: "avatar-proxy"`

- Скачивание изображений из Supabase Storage через серверную сторону
- Принимает (query params в теле): `bucket`, `path`

## 6. Примеры использования

### Запрос к базе данных
```javascript
fetch(YANDEX_PROXY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'select',
    table: 'profiles',
    select: '*',
    filters: [{ column: 'user_id', operator: 'eq', value: userId }]
  })
});
```

### Загрузка файла в Storage
```javascript
fetch(YANDEX_PROXY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    _proxyTarget: 'storage-proxy',
    action: 'upload',
    bucket: 'avatars',
    path: 'user123/avatar.jpg',
    fileBase64: '...base64 encoded file...',
    contentType: 'image/jpeg',
    upsert: true
  })
});
```

### Загрузка файла в чат (Yandex S3)
```javascript
fetch(YANDEX_PROXY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    _proxyTarget: 'yandex-s3-upload',
    fileName: 'photo.jpg',
    fileBase64: '...base64 encoded file...',
    contentType: 'image/jpeg'
  })
});
```
