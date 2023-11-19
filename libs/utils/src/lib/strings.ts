export const removeMentions = (content: string) =>
  content.replace(/<[@#]\S*>|@(everyone|here)/gm, '');

export const generateTitle = (sentence: string) => {
  let cleanedSentence = removeMentions(sentence.toLowerCase());
  cleanedSentence = cleanedSentence.replace(/[^ a-zA-Z0-9_-]+/g, '');
  cleanedSentence = cleanedSentence.replace(/\s\s+/gm, ' ');
  cleanedSentence = cleanedSentence.trim();

  return cleanedSentence.split(' ').join('-').substring(0, 100);
};
