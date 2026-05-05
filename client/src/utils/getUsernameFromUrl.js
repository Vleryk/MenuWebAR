const getUsernameFromUrl = (url) => {
  const parts = url.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2];
};

export { getUsernameFromUrl };
