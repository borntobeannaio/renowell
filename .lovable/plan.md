
# План: Просмотр полного поста Telegram

## Текущее поведение
- Посты отображаются в карточках с обрезанным текстом (`line-clamp-4` — 4 строки)
- Клик по карточке открывает пост в Telegram в новой вкладке
- Нет возможности прочитать длинный пост целиком внутри приложения

## Новое поведение
- Клик по карточке открывает модальное окно с полным содержимым поста
- В модалке отображается:
  - Изображение/видео в полном размере (если есть)
  - Полный текст поста без обрезки
  - Дата публикации
  - Кнопка "Открыть в Telegram" для перехода в оригинал
- Кнопка закрытия в правом верхнем углу
- Закрытие по Escape или клику на оверлей

## Изменения в коде

### Файл: `src/components/modules/brandhub/TelegramFeed.tsx`

1. Добавить состояние для выбранного поста:
```tsx
const [selectedPost, setSelectedPost] = useState<TelegramPost | null>(null);
```

2. Изменить `PostCard` — заменить ссылку на кнопку:
```tsx
// Было: <a href={post.link} target="_blank">
// Станет: <div onClick={() => onSelect(post)}>
```

3. Добавить компонент модального окна `PostModal`:
```tsx
function PostModal({ post, onClose }: { post: TelegramPost; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Изображение */}
        {post.image_url && (
          <img src={post.image_url} className="w-full rounded-lg" />
        )}
        
        {/* Полный текст */}
        <p className="whitespace-pre-wrap">{post.text}</p>
        
        {/* Дата и кнопка */}
        <div className="flex justify-between">
          <span>{format(date, "d MMMM yyyy, HH:mm")}</span>
          <Button asChild>
            <a href={post.link} target="_blank">Открыть в Telegram</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

4. Рендерить модалку при выбранном посте:
```tsx
{selectedPost && (
  <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
)}
```

## Навигация клавишами

- **Escape** — закрыть модалку (стандартное поведение Dialog)
- Опционально: стрелки влево/вправо для переключения между постами

## Визуальный стиль

- Использовать существующий компонент `Dialog` из UI-библиотеки
- Размытый тёмный оверлей (`bg-black/80`)
- Плавная анимация появления
- Максимальная ширина `max-w-2xl` для комфортного чтения
- Скролл внутри модалки для очень длинных постов
