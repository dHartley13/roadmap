import { supabase } from './supabase'

function weekToLabel(week) {
  if (week === undefined || week === null) return '—'
  const monthIdx = Math.floor(week / 4)
  const weekNum  = (week % 4) + 1
  const month    = MONTHS[monthIdx] || '—'
  return `${month} W${weekNum}`
}

export async function logEvent({
  eventType,
  entityType,
  entityId,
  entityName,
  pillarId = null,
  teamId = null,
  oldValue = null,
  newValue = null,
}) {
  await supabase.from('audit_log').insert({
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    pillar_id: pillarId,
    team_id: teamId,
    old_value: oldValue,
    new_value: newValue,
  })
}