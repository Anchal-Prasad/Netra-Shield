const ExportButton = ({ onClick, text = "Export All" }) => {
  return (
    <button onClick={onClick} className="filter-btn filter-btn--green">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {text}
    </button>
  );
};

export default ExportButton;