

## План: Исправить rate limit при отправке email-приглашений

### Проблема
Resend API допускает максимум 2 запроса в секунду. Функция `send-calendar-invite` отправляет все письма в цикле без пауз — 4 из 6 получили ошибку 429.

### Решение

**`supabase/functions/send-calendar-invite/index.ts`**

Добавить задержку 600ms между отправками и retry при 429:

```typescript
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

for (const recipient of emails) {
  // ... send logic
  if (res.status === 429) {
    await delay(1500);
    // retry once
    res = await fetch(...);
  }
  sentCount++;
  await delay(600); // пауза между письмами
}
```

Один файл, затем передеплой функции.

