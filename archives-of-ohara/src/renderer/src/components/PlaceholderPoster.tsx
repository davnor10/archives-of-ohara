import CloverLogo from './CloverLogo'

interface Props {
  title: string
}

export default function PlaceholderPoster({ title }: Props) {
  return (
    <div className="placeholder-poster">
      <CloverLogo size={40} color="rgba(201,168,76,0.35)" />
      <span className="placeholder-poster-title">{title}</span>
    </div>
  )
}
