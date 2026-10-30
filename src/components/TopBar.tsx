import { TEXT } from '../lib/brand'
import { SearchIcon } from './Icons'
import { Logo } from './Logo'

type Props = {
  playing?: boolean
  onSearch: () => void
}

export function TopBar({ playing = false, onSearch }: Props) {
  return (
    <header className="top-bar">
      <Logo playing={playing} />
      <button type="button" className="top-search" onClick={onSearch}>
        <SearchIcon size={16} />
        <span>{TEXT.searchPlaceholder}</span>
      </button>
    </header>
  )
}
