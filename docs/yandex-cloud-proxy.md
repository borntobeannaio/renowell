# Yandex Cloud Function Proxy для db-proxy

## 1. Создайте функцию в Yandex Cloud Console

1. Перейдите в [Yandex Cloud Console](https://console.yandex.cloud/)
2. Создайте новую Cloud Function
3. Выберите runtime: **Node.js 18**
4. Скопируйте код ниже

## 2. Код функции (index.js)

```javascript
const https = require('https');

const SUPABASE_URL = 'https://kstfczzkskpmsswmanif.supabase.co/functions/v1/db-proxy';
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
        const body = event.body;
        
        const response = await new Promise((resolve, reject) => {
            const url = new URL(SUPABASE_URL);
            const options = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                timeout: 25000,
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
            req.write(body);
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

## 5. Добавьте URL в приложение

Добавьте секрет `EXTERNAL_PROXY_URL` со значением URL вашей Yandex функции.
