/** Vehicle locomotion is about actual distance travelled, not orders.
 * A pathfinding retry, rally target, paused engine or open garage door must
 * never make a stationary Humvee's tyres rotate. */
export const WHEEL_EPSILON=.15;
export function wheelsShouldRoll(kind,travel){
 if(!['rover','tank','artillery'].includes(kind))return false;
 return Number.isFinite(travel)&&travel>WHEEL_EPSILON&&travel<180;
}
export function rolloutWheelsShouldRoll(moving,speed){
 return moving===true&&Number.isFinite(speed)&&speed>.25;
}
