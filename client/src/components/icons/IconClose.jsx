function IconClose(props) {
  return (
    <svg
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      className="icon icon-tabler icons-tabler-outline icon-tabler-x"
      {...props}
    >
      <path d="M0 0h24v24H0z" stroke="none" />
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export { IconClose };
