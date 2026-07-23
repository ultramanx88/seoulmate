export type BasicSticker = {
  id: string;
  emoji: string;
  th: string;
  kr: string;
  tone: 'coral' | 'mint' | 'lilac' | 'honey' | 'ink';
};

export const basicStickers: BasicSticker[] = [
  { id: 'basic-hello', emoji: '👋', th: 'สวัสดี', kr: '안녕', tone: 'coral' },
  { id: 'basic-smile', emoji: '😊', th: 'ยิ้มให้', kr: '미소', tone: 'mint' },
  { id: 'basic-thanks', emoji: '🙏', th: 'ขอบคุณนะ', kr: '고마워요', tone: 'lilac' },
  { id: 'basic-sorry', emoji: '🌧️', th: 'ขอโทษนะ', kr: '미안해요', tone: 'honey' },
  { id: 'basic-heart', emoji: '💗', th: 'ใจฟู', kr: '설레요', tone: 'coral' },
  { id: 'basic-shy', emoji: '🫣', th: 'เขินนิดนึง', kr: '조금 부끄러워', tone: 'lilac' },
  { id: 'basic-laugh', emoji: 'ㅋㅋ', th: 'ขำมาก', kr: 'ㅋㅋㅋ', tone: 'honey' },
  { id: 'basic-cheer', emoji: '✨', th: 'สู้ ๆ นะ', kr: '화이팅', tone: 'mint' },
  { id: 'basic-coffee', emoji: '☕', th: 'กาแฟไหม', kr: '커피 어때요', tone: 'ink' },
  { id: 'basic-food', emoji: '🍜', th: 'กินข้าวกัน', kr: '밥 먹자', tone: 'honey' },
  { id: 'basic-walk', emoji: '🚶', th: 'ไปเดินเล่นไหม', kr: '산책할래요', tone: 'mint' },
  { id: 'basic-movie', emoji: '🎬', th: 'ดูหนังกัน', kr: '영화 볼래요', tone: 'ink' },
  { id: 'basic-wait', emoji: '⏳', th: 'รอก่อนนะ', kr: '잠깐만요', tone: 'lilac' },
  { id: 'basic-safe', emoji: '🛡️', th: 'คุยสบาย ๆ', kr: '편하게 말해요', tone: 'mint' },
  { id: 'basic-miss', emoji: '🌙', th: 'คิดถึงนะ', kr: '보고 싶어요', tone: 'coral' },
  { id: 'basic-goodnight', emoji: '💤', th: 'ฝันดีนะ', kr: '잘 자요', tone: 'ink' },
];

export const basicStickerIds = new Set(basicStickers.map((sticker) => sticker.id));

export function getBasicSticker(stickerId: string | null | undefined): BasicSticker | null {
  if (!stickerId) return null;
  return basicStickers.find((sticker) => sticker.id === stickerId) ?? null;
}

export function getStickerLabel(sticker: BasicSticker, locale: 'TH' | 'KR'): string {
  return locale === 'KR' ? sticker.kr : sticker.th;
}
