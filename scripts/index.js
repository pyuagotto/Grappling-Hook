//@ts-check

import { EntityComponentTypes, EntityInitializationCause, system, world } from "@minecraft/server";

/**
 * 
 * @param {import("@minecraft/server").Vector3} a 
 * @param {import("@minecraft/server").Vector3} b
 * @returns {{horizontalForce: import("@minecraft/server").VectorXZ, verticalStrength: number}}
 */
const calculateKnockback = function(a, b){
    const horizontalStrength = Math.cbrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
    const verticalStrength = Math.cbrt(Math.pow(a.y - b.y, 2)) / 2;

    const direction = {
        x: b.x - a.x,
        z: b.z - a.z,
    };

    const horizontalForce = {
        x: horizontalStrength * direction.x  / Math.hypot(direction.x, direction.z), 
        z: horizontalStrength * direction.z  / Math.hypot(direction.x, direction.z), 
    };

    return{
        horizontalForce,
        verticalStrength
    }
}

const flag = [];

world.beforeEvents.itemUse.subscribe((ev) => {
    const { itemStack, source } = ev;

    if(itemStack.typeId !== "minecraft:fishing_rod") return;
    flag.push(source);
    system.runTimeout(() => {
        const index = flag.indexOf(source);
        if (index !== -1) {
            flag.splice(index, 1);
        }
    }, 1)
});

world.afterEvents.entitySpawn.subscribe((ev) => {
    const { cause, entity } = ev;

    if(cause === EntityInitializationCause.Spawned && entity.typeId === "minecraft:fishing_hook"){
        // flagに存在しないプレイヤーの名前を除外リストとして作成
        const excludeNames = world.getPlayers().filter(p => !flag.includes(p)).map(p => p.name);
        const closestPlayer = entity.dimension.getPlayers({location: entity.location, closest: 1, excludeNames: excludeNames })[0];
        const projectileComponent = entity.getComponent(EntityComponentTypes.Projectile);

        if(projectileComponent) {
            projectileComponent.owner = closestPlayer;
        }
    }
});

world.beforeEvents.entityRemove.subscribe((ev) => {
    const { removedEntity } = ev;

    if(removedEntity.typeId !== "minecraft:fishing_hook") return;
    const player = removedEntity.getComponent(EntityComponentTypes.Projectile)?.owner;
    if(!player) return;
    if(!flag.includes(player)) return;
    if(!removedEntity.isOnGround) return;

    const playerLocation = player.location;
    const hookLocation = removedEntity.location;
    const kb = calculateKnockback(playerLocation, hookLocation);
    system.run(()=>{
        player?.applyKnockback(kb.horizontalForce, kb.verticalStrength);
    })
});
