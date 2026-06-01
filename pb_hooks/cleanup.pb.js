/// <reference path="../pb_data/types.d.ts" />

cronAdd('cleanup-notifications', '0 0 * * *', () => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();

    const oldNotifications = $app.findRecordsByFilter(
      'notifications',
      `created < "${cutoffStr}"`,
      '',
      0,
      0,
    );

    for (const notif of oldNotifications) {
      $app.delete(notif);
    }

    console.log(`[cleanup] Deleted ${oldNotifications.length} old notifications`);
  } catch (err) {
    $app.logger().error('[cleanup] Failed to clean up old notifications', {
      error: String(err),
    });
  }
});
