export function getFolderLabel(folderStructure = 'flat') {
  if (folderStructure === 'flat') return null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (folderStructure === 'year') return String(year);
  if (folderStructure === 'semester') {
    return `${year}-${month < 6 ? 'S1' : 'S2'}`;
  }
  if (folderStructure === 'quarter') {
    const q = Math.floor(month / 3) + 1;
    return `${year}-Q${q}`;
  }
  return null;
}
