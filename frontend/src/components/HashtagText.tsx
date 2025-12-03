interface HashtagTextProps {
  text: string;
  onHashtagClick: (hashtag: string) => void;
}

export default function HashtagText({ text, onHashtagClick }: HashtagTextProps) {
  const hashtagRegex = /#([a-zA-Z0-9_-]+)/g;
  const parts: Array<{ type: 'text' | 'hashtag'; content: string }> = [];
  let lastIndex = 0;

  const matches = text.matchAll(hashtagRegex);
  for (const match of matches) {
    // Add text before hashtag
    if (match.index! > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add hashtag
    parts.push({
      type: 'hashtag',
      content: match[1].toLowerCase(),
    });

    lastIndex = match.index! + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'hashtag' ? (
          <a
            key={index}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHashtagClick(part.content);
            }}
            className="text-violet-600 hover:text-black hover:underline"
          >
            #{part.content}
          </a>
        ) : (
          <span key={index}>{part.content}</span>
        )
      )}
    </>
  );
}
