type Props = {
  title: string
  description: string
}

/** 各タブの中身ができるまでの仮表示カード */
export default function PagePlaceholder({ title, description }: Props) {
  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-[var(--space-md)] rounded-md bg-surface p-[var(--space-lg)] text-ink-muted shadow-sm border border-edge">
        {description}
      </div>
    </div>
  )
}
