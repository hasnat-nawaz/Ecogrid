export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader-wrap">
      <div className="bulb">
        <div className="glass" />
        <div className="base" />
      </div>
      <p>{label}</p>
    </div>
  );
}
