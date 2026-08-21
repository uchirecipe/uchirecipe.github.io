import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, BookmarkPlus, X } from 'lucide-react'
import BackHeader from '../components/BackHeader'
import Toast from '../components/Toast'
import { useConfirm } from '../components/ConfirmProvider'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { useScrollLock } from '../components/useScrollLock'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import {
  addMealEntry,
  removeMealEntries,
  useEarliestMealPlanDate,
  useMealPlanRange,
} from '../db/mealPlan'
import { useMealPlanLocks, toLockKeySet } from '../db/mealPlanLocks'
import { saveMealTemplate } from '../db/mealTemplates'
import {
  MEAL_SLOTS,
  copySourceWeekView,
  dowIndex,
  maxCopySourceWeeksBack,
  planCopyLastWeek,
  shiftDate,
  sortMealSlots,
  weekDates,
} from '../logic/mealPlan'
import { buildTemplateItems, TEMPLATE_NAME_MAX_LENGTH } from '../logic/mealTemplate'
import { todayString } from '../logic/date'
import { isImeConfirmKey } from '../logic/imeKey'
import { ja } from '../i18n/ja'
import type { MealSlot, Recipe } from '../db/types'

/**
 * 「別の週から入れる」の画面（2026-08-21 便IO）。
 *
 * オーナー原文:
 *   「先週に限らず、ユーザーが選んだ７日間を指定（献立一覧で表示して、今表示している
 *     ７日間の献立を今週に反映、と言った感じ？献立の中身も確認できるし。いい案求む）
 *     →この週の献立をコピー（名前はちゃんと考えて）、この週の献立をテンプレートとして
 *     保存、みたいな？」
 *
 * 【なぜ画面を分けたか】週タブは「表示している週＝入れる先」という前提で全部が組んである
 * （2026-08-20 便IIの申し送り）。中身を見るために週を送ると入れる先まで動いてしまい、
 * 「いま見ている週」が2つの意味を持って壊れる。だから**入れ先は動かないまま**（?to= で
 * 受け取って固定する）、この画面の中だけで週を送って中身を見る。
 *
 * 【前の形との関係】2026-08-20 便II・⑤の「コピー元の週」のプルダウン（1〜4週間前）は
 * この画面に置き換えた。**同じことをする道を2つ置かない**ため、週タブ側のプルダウンと
 * 出しかたの2択（おまかせ／週をコピー）は無くしてある。
 *
 * 【どこまでさかのぼれるか】献立の行は日付で消したりしないので、データがある一番古い日まで
 * 送れる（logic/mealPlan.ts の maxCopySourceWeeksBack）。それより前へは送れない
 * ＝送っても必ず空の週しか出ない道は作らない。
 *
 * 【入れかた】空いた枠だけ／総入れ替えは 2026-08-19 便IF・⑧でコピーにも効くようになった
 * ものをそのまま持ってきた。総入れ替えは消える操作なので、押す前に規約Fの確認を必ず出す。
 * 鍵の掛かった食事・過ぎた日・表示していない食事に触れないのは planCopyLastWeek が守る。
 */
export default function MealPlanCopyWeekPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const settings = useSettings()
  const recipes = useLiveQuery(listRecipes, [])
  const today = useMemo(() => todayString(), [])

  /**
   * 入れ先の週（「週」の画面で表示していた7日間）。?to= に7日間の初日が入る。
   * 手で打った URL などで受け取れなかったときは、週タブと同じ「いまの週」に倒す
   * （週区切り表示なら今週の月曜、今日を先頭に7日間の表示なら今日）。
   */
  const targetStart = useMemo(() => {
    const raw = searchParams.get('to')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return settings?.weekStartsToday ? today : weekDates(new Date())[0]
  }, [searchParams, settings?.weekStartsToday, today])
  const targetDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(targetStart, i)),
    [targetStart],
  )

  /** 表示する食事（週タブと同じ設定値を見る＝画面ごとに違う食事を出さない） */
  const visibleSlots: MealSlot[] = useMemo(
    () => sortMealSlots(settings?.visibleMealSlots ?? [...MEAL_SLOTS]),
    [settings?.visibleMealSlots],
  )

  /** いま中身を見ている週が、入れ先の何週間前か（1＝1週間前。開いた直後はここから） */
  const [weeksBack, setWeeksBack] = useState(1)
  const sourceDates = useMemo(
    () => targetDates.map((d) => shiftDate(d, -7 * weeksBack)),
    [targetDates, weeksBack],
  )
  const sourceEntries = useMealPlanRange(sourceDates[0], sourceDates[6])
  const targetEntries = useMealPlanRange(targetDates[0], targetDates[6])
  const earliestPlanDate = useEarliestMealPlanDate()
  const maxWeeksBack = useMemo(
    () => maxCopySourceWeeksBack(targetStart, earliestPlanDate ?? undefined),
    [targetStart, earliestPlanDate],
  )
  /** 献立を1件も入れていない人（読み込み中の undefined とは区別する。db/mealPlan.ts 参照） */
  const noPlansYet = earliestPlanDate === null
  const mealPlanLocks = useMealPlanLocks()
  const lockedKeys = useMemo(() => toLockKeySet(mealPlanLocks), [mealPlanLocks])

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    ;(recipes ?? []).forEach((r) => {
      if (r.id != null) map.set(r.id, r)
    })
    return map
  }, [recipes])

  /** 画面に並べる「その週の中身」。実際に入るものと同じ判断で作る（logic/mealPlan.ts） */
  const view = useMemo(
    () => copySourceWeekView(sourceEntries ?? [], sourceDates, visibleSlots),
    [sourceEntries, sourceDates, visibleSlots],
  )
  const sourceCount = view.reduce(
    (sum, day) => sum + day.slots.reduce((n, s) => n + s.recipeIds.length, 0),
    0,
  )

  const [fillMode, setFillMode] = useState<'fillEmpty' | 'replaceAll'>('fillEmpty')
  const [message, setMessage] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  useOverlayDismiss(saveOpen, () => setSaveOpen(false))
  useScrollLock(saveOpen)

  const ymd = (date: string) => date.replaceAll('-', '/')
  const range = { start: ymd(sourceDates[0]), end: ymd(sourceDates[6]) }
  const targetRange = { start: ymd(targetDates[0]), end: ymd(targetDates[6]) }
  /** コピー元（{start}{end}）と入れ先（{toStart}{toEnd}）の日付を文言へ差し込む */
  const withDates = (text: string) =>
    text
      .replace('{start}', range.start)
      .replace('{end}', range.end)
      .replace('{toStart}', targetRange.start)
      .replace('{toEnd}', targetRange.end)
  const lockNoticeOf = (count: number) =>
    count > 0 ? ja.mealPlan.lockedSlotNotice.replace('{n}', String(count)) : ''
  const withNotice = (text: string, notice: string) => (notice ? `${text} ${notice}` : text)

  /**
   * 見ている週の献立を入れ先へ入れる。
   * どこへ何を写すかの判断は純ロジック（planCopyLastWeek）が持ち、この画面は書き込むだけ
   * ＝週タブから実行していたときと1文字も違う判断をしない。
   */
  const run = async () => {
    setMessage('')
    const replaceAll = fillMode === 'replaceAll'
    const { ops, sourceTotal, lockedSlotCount, entryIdsToRemove, replacedSlotCount } =
      planCopyLastWeek({
        dates: targetDates,
        today,
        visibleSlots,
        entries: targetEntries ?? [],
        prevEntries: sourceEntries ?? [],
        weeksBack,
        lockedKeys,
        replaceAll,
      })
    const lockNotice = lockNoticeOf(lockedSlotCount)
    // 中身の無い週から「総入れ替え」を走らせると、入れ先を黙って空にすることになる。
    // 写すものが1品も無いときは、どちらの入れかたでも何もしない（消すだけの操作にしない）
    if (sourceTotal === 0) {
      setMessage(withNotice(withDates(ja.mealPlan.copyWeekNoSource), lockNotice))
      return
    }
    if (ops.length === 0 && entryIdsToRemove.length === 0) {
      setMessage(
        withNotice(
          replaceAll ? ja.mealPlan.copyWeekReplaceAllNothing : ja.mealPlan.copyWeekNoRoom,
          lockNotice,
        ),
      )
      return
    }
    if (replaceAll) {
      // 規約F: 何が消えて何が残るかを件数つきで両方書く。窓の中には入れ先が出ていないので、
      // 見出しで入れ先の7日間も日付で言い切る
      const ok = await confirm({
        title: withDates(ja.mealPlan.copyWeekReplaceAllConfirmTitle).replace(
          '{n}',
          String(ops.length),
        ),
        body: '',
        bullets: [
          {
            label: ja.mealPlan.fillModeReplaceAllGoneLabel,
            text: ja.mealPlan.copyWeekReplaceAllGone
              .replace('{s}', String(replacedSlotCount))
              .replace('{n}', String(entryIdsToRemove.length)),
          },
          {
            label: ja.mealPlan.fillModeReplaceAllKeptLabel,
            text: ja.mealPlan.copyWeekReplaceAllKept,
          },
        ],
        notes: lockNotice ? [lockNotice] : [],
        confirmLabel: ja.mealPlan.fillModeReplaceAllConfirmOk,
      })
      if (!ok) return
      await removeMealEntries(entryIdsToRemove)
      for (const op of ops) {
        await addMealEntry(op.date, op.slot, op.recipeId, op.role)
      }
      goBackWith(
        withNotice(
          withDates(ja.mealPlan.copyWeekReplaceAllDone).replace('{n}', String(ops.length)),
          lockNotice,
        ),
      )
      return
    }
    // 空いた枠だけ（非破壊）。残る品数も数えて書く（規約F: 何が残るかも件数つきで）
    const keptCount = (targetEntries ?? []).filter(
      (e) => e.date >= today && visibleSlots.includes(e.slot),
    ).length
    const ok = await confirm({
      title: withDates(ja.mealPlan.copyWeekConfirmTitle).replace('{n}', String(ops.length)),
      body: ja.mealPlan.copyWeekConfirm.replace('{k}', String(keptCount)),
      notes: lockNotice ? [lockNotice] : [],
      confirmLabel: ja.mealPlan.copyWeekConfirmOk,
    })
    if (!ok) return
    // auto=false(既定)で追加＝手動配置として保護される（週タブから実行していたときと同じ）
    for (const op of ops) {
      await addMealEntry(op.date, op.slot, op.recipeId, op.role)
    }
    goBackWith(
      withNotice(withDates(ja.mealPlan.copyWeekDone).replace('{n}', String(ops.length)), lockNotice),
    )
  }

  /**
   * 入れ終わったら「週」の画面の**入れ先の週**へ戻し、何が入ったかをそこで知らせる。
   * この画面に留まると、入った結果を確かめる場所が無い（2026-08-09 便ENの
   * 「押さないといけないことに気づけない」と同じで、次の一手を利用者に探させない）。
   */
  const goBackWith = (toast: string) => {
    navigate(`/meal-plan?focus=week&date=${targetDates[0]}`, { state: { toast } })
  }

  /** 見ている週をそのままテンプレートとして覚える（曜日ごと。週タブの保存と同じ仕組み） */
  const templateItems = useMemo(
    () => buildTemplateItems(sourceEntries ?? [], sourceDates),
    [sourceEntries, sourceDates],
  )
  const openSave = () => {
    if (templateItems.length === 0) {
      setMessage(ja.mealPlan.copyPickSaveEmpty)
      return
    }
    setTemplateName('')
    setSaveOpen(true)
  }
  const submitSave = async () => {
    const name = templateName.trim()
    if (name === '') {
      setMessage(ja.mealPlan.templateNameRequired)
      return
    }
    await saveMealTemplate(name, templateItems)
    setSaveOpen(false)
    setMessage(
      ja.mealPlan.templateSaveDone
        .replace('{name}', name)
        .replace('{n}', String(templateItems.length)),
    )
  }

  const dowLabels = ja.mealPlan.dow
  const atOldest = weeksBack >= maxWeeksBack
  const atNewest = weeksBack <= 1

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      {/* 戻るは必ず入れ先の週へ返す（見ていた週へは戻さない＝入れ先は動かさない） */}
      <BackHeader
        fallback={`/meal-plan?focus=week&date=${targetDates[0]}`}
        alwaysFallback
        title={ja.mealPlan.copyPickTitle}
      />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        <p className="text-sm text-ink-muted">{ja.mealPlan.copyPickDescription}</p>
        {/* 入れ先はこの画面に出ていないので、日付で言い切る（規約H） */}
        <p
          data-testid="copy-pick-target"
          data-start={targetDates[0]}
          data-end={targetDates[6]}
          className="mt-[var(--space-sm)] rounded-sm border border-edge bg-app p-[var(--space-sm)] text-sm font-bold"
        >
          {ja.mealPlan.copyPickTarget
            .replace('{start}', targetRange.start)
            .replace('{end}', targetRange.end)}
        </p>

        {/* 見ている週の送り。前後どちらへも送れる（片方向だと別の日付境界で行き止まりになる） */}
        <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="copy-pick-prev"
            onClick={() => setWeeksBack((n) => Math.min(maxWeeksBack, n + 1))}
            disabled={atOldest}
            aria-label={ja.mealPlan.prevWeek}
            className="tap-target rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm disabled:opacity-40"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p
            data-testid="copy-source-week"
            data-start={sourceDates[0]}
            data-end={sourceDates[6]}
            className="text-sm font-bold tabular-nums"
          >
            {range.start}〜{range.end}
          </p>
          <button
            type="button"
            data-testid="copy-pick-next"
            onClick={() => setWeeksBack((n) => Math.max(1, n - 1))}
            disabled={atNewest}
            aria-label={ja.mealPlan.nextWeek}
            className="tap-target rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm disabled:opacity-40"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
        {/* まだ献立を1件も入れていない人には、行き止まりにしないための1行を出す
            （便HS・空の型）。それ以外は、その週に何品入っているかを出す */}
        {noPlansYet ? (
          <p data-testid="copy-pick-no-plans" className="mt-[var(--space-sm)] text-sm text-ink-muted">
            {ja.mealPlan.copyPickNoPlansYet}
          </p>
        ) : (
          <p className="mt-1 text-center text-xs text-ink-muted">
            {sourceCount > 0
              ? ja.mealPlan.copyPickWeekCount.replace('{n}', String(sourceCount))
              : ja.mealPlan.copyPickWeekEmpty}
            {atOldest && `（${ja.mealPlan.copyPickOldest}）`}
          </p>
        )}

        {/* その週の中身（読むだけ）。並べるのは表示している食事だけ＝入らないものを見せない */}
        <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          {view.map((day) => (
            <section
              key={day.date}
              data-testid="copy-source-day"
              data-date={day.date}
              className="rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
            >
              <h2 className="text-sm font-bold tabular-nums">
                {dowLabels[dowIndex(day.date)]} {ymd(day.date)}
              </h2>
              {day.slots.length === 0 ? (
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.copyPickDayEmpty}</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {day.slots.map(({ slot, recipeIds }) => (
                    <div key={slot} className="flex gap-2">
                      <p className="w-10 shrink-0 pt-0.5 text-xs font-bold text-ink-muted">
                        {ja.mealPlan.slot[slot]}
                      </p>
                      <ul className="min-w-0 flex-1 space-y-0.5">
                        {recipeIds.map((recipeId, i) => (
                          <li
                            key={`${recipeId}-${i}`}
                            data-testid="copy-source-item"
                            data-date={day.date}
                            data-slot={slot}
                            data-recipe-id={recipeId}
                            className="ja-phrase text-sm"
                          >
                            {recipeById.get(recipeId)?.title ?? ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* 入れかた（2026-08-19 便IF・⑧）。形は週タブの「入れかた」と同じプルダウン */}
        <div className="mt-[var(--space-md)]">
          <label className="block">
            <span className="block text-sm font-bold text-ink-muted">
              {ja.mealPlan.fillModeTitle}
            </span>
            <select
              data-testid="copy-pick-fill-mode"
              value={fillMode}
              onChange={(e) => setFillMode(e.target.value as 'fillEmpty' | 'replaceAll')}
              className="select-control mt-1 w-full"
            >
              <option value="fillEmpty">{ja.mealPlan.fillModeFillEmpty}</option>
              <option value="replaceAll">{ja.mealPlan.fillModeReplaceAll}</option>
            </select>
          </label>
          <p data-testid="copy-pick-hint" className="mt-1 text-xs text-ink-muted">
            {withDates(
              fillMode === 'replaceAll'
                ? ja.mealPlan.copyWeekReplaceAllHint
                : ja.mealPlan.copyWeekFillEmptyHint,
            )}
          </p>
        </div>

        <button
          type="button"
          data-testid="copy-pick-run"
          onClick={() => void run()}
          className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
        >
          <Copy size={20} aria-hidden />
          {ja.mealPlan.copyPickRun}
        </button>
        {/* オーナー案の「この週の献立をテンプレートとして保存」。入れ先を動かさずに、
            いま見ている週をそのまま覚えられる道はここにしかない */}
        <button
          type="button"
          data-testid="copy-pick-save-template"
          onClick={openSave}
          className="tap-target mt-[var(--space-sm)] flex w-full items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
        >
          <BookmarkPlus size={18} aria-hidden />
          {ja.mealPlan.copyPickSaveTemplate}
        </button>
      </div>

      {/* テンプレートの名前を付ける窓（週タブの保存の窓と同じ形・同じ文言） */}
      {saveOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setSaveOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.mealPlan.copyPickSaveTemplate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.mealPlan.copyPickSaveTemplate}</h3>
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {ja.mealPlan.templateSaveRange
                .replace('{start}', range.start)
                .replace('{end}', range.end)
                .replace('{n}', String(templateItems.length))}
            </p>
            <label className="mt-[var(--space-md)] block text-sm font-bold text-ink-muted">
              {ja.mealPlan.templateNameLabel}
              <input
                type="text"
                value={templateName}
                maxLength={TEMPLATE_NAME_MAX_LENGTH}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  // 変換確定のEnterでは保存しない（週タブの保存の窓と同じ判定）
                  if (e.key === 'Enter' && !isImeConfirmKey(e)) void submitSave()
                }}
                placeholder={ja.mealPlan.templateNamePlaceholder}
                className="mt-1 w-full rounded-sm border border-edge bg-app px-2 py-2 text-base font-normal text-ink placeholder:text-ink-muted/60"
              />
            </label>
            <button
              type="button"
              data-testid="copy-pick-save-submit"
              onClick={() => void submitSave()}
              className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
            >
              {ja.mealPlan.templateSaveButton}
            </button>
          </div>
        </div>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}
