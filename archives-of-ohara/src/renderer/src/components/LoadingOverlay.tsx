import { useStore } from '../store'
import Spinner from './Spinner'

export default function LoadingOverlay() {
  const { isScanning, isFetchingTmdb } = useStore()
  if (!isScanning && !isFetchingTmdb) return null
  const message = isScanning ? 'Scanning library…' : 'Fetching metadata…'
  return (
    <div className="loading-overlay">
      <Spinner size="lg" />
      <div className="loading-overlay-msg">{message}</div>
    </div>
  )
}
