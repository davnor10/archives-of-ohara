import CloverLogo from './CloverLogo'

interface Props {
  size?: 'sm' | 'lg'
}

// sm: 36×36 container, logo 20px, orbit radius 14px, compass 7px
// lg: 100×100 container, logo 50px, orbit radius 43px, compass 12px
export default function Spinner({ size = 'sm' }: Props) {
  const period = 2.4
  return (
    <span className={`ohara-spinner ohara-spinner-${size}`} aria-label="Loading">
      <span className="ohara-spinner-logo">
        <CloverLogo size={size === 'sm' ? 20 : 50} />
      </span>
      {[0, 1, 2].map((i) => {
        const delay = `${-(i * period / 3).toFixed(3)}s`
        return (
          <span key={i} className="ohara-orbit-wrapper" style={{ animationDelay: delay }}>
            <span className="ohara-orbit-compass" style={{ animationDelay: delay }}>🧭</span>
          </span>
        )
      })}
    </span>
  )
}
