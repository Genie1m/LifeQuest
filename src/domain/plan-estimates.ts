export function estimateWork(tasks: ReadonlyArray<{estimatedMinutes: number}>, weeklyHours: number) {
  const weeklyMinutes = weeklyHours * 60;
  const valid = tasks.every(task => Number.isInteger(task.estimatedMinutes) && task.estimatedMinutes >= 5 && task.estimatedMinutes <= 600);
  const minutes = valid ? tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) : null;
  return {
    minutes,
    weeklyMinutes,
    minimumWeeks: minutes === null ? null : Math.ceil(minutes / weeklyMinutes),
  };
}
