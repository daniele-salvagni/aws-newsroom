import { useState, useEffect } from 'react';

interface StreamingTextProps {
  text: string;
  speed?: number; // words per batch
}

export default function StreamingText({ text, speed = 2 }: StreamingTextProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const words = text.split(' ');

  useEffect(() => {
    if (currentWordIndex < words.length) {
      const timer = setTimeout(() => {
        const nextIndex = Math.min(currentWordIndex + speed, words.length);
        setDisplayedWords(words.slice(0, nextIndex));
        setCurrentWordIndex(nextIndex);
      }, 30); // 30ms between batches

      return () => clearTimeout(timer);
    }
  }, [currentWordIndex, words, speed]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedWords([]);
    setCurrentWordIndex(0);
  }, [text]);

  return <span className="animate-[fadeIn_0.3s_ease-in]">{displayedWords.join(' ')}</span>;
}
