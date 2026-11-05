import pool from './db.js';

export async function logActivity(ownerId, actor, action, module, description) {
  try {
    const actorName = actor.actorType === 'employee'
      ? `${actor.teamMemberName || 'Employee'}${actor.empId ? ` (${actor.empId})` : ''}`
      : (actor.email || 'Admin');

    await pool.query(
      'INSERT INTO activity_logs (owner_user_id, actor_type, actor_name, team_member_id, action, module, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [ownerId, actor.actorType || 'admin', actorName, actor.teamMemberId || null, action, module, description]
    );
  } catch (error) {
    console.error('Activity log error', error);
  }
}
