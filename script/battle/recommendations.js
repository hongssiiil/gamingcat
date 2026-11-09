import { skillEffects } from "./rules.js";

export function getTurnRecommendation(state) {
    const { player, enemy } = state;
    const stamina = player.stamina;
    const playerHealth = player.health;
    const enemyHealth = enemy.health;
    const enemyStamina = enemy.stamina;
    let recommendation;

    if (stamina < 30 && enemyHealth > 20) {
        recommendation = { skillIndex: 1, text: "아직 힘이 남아 있을 때 몰아붙이자! 힘껏 휘두르기!" };
    } else if (stamina < 30 && enemyHealth <= 20) {
        recommendation = { skillIndex: 1, text: "마지막 기회야! 힘껏 휘둘러서 끝내자!" };
    } else if (enemyHealth <= 20) {
        recommendation = { skillIndex: 2, text: "다음 공격을 위해 숨을 고르자!" };
    } else if (playerHealth <= 20) {
        recommendation = { skillIndex: 1, text: "위험해지기 전에 힘껏 휘둘러 끝내자!" };
    } else if (enemyStamina < 30) {
        recommendation = { skillIndex: 1, text: "늑대가 지친 지금, 힘껏 휘두르자!" };
    } else if (stamina >= 80) {
        recommendation = { skillIndex: 2, text: "스태미나가 넉넉하니까 숨을 고르고 더 채워 두자!" };
    } else if (stamina >= 50) {
        recommendation = { skillIndex: 1, text: "큰 한 방이면 전세를 뒤집을 수 있어! 힘껏 휘두르자!" };
    } else if (stamina >= 30 && enemyHealth > 40) {
        recommendation = { skillIndex: 1, text: "지금은 아껴서 공격할 때가 아니야! 힘껏 휘두르자!" };
    } else if (playerHealth <= 35 && enemyHealth <= 40) {
        recommendation = { skillIndex: 0, text: "조금만 더 버티면 돼. 일반 공격으로 압박하자!" };
    } else {
        recommendation = { skillIndex: 0, text: "안전하게 일반 공격으로 조금씩 압박하자!" };
    }

    const skill = skillEffects[recommendation.skillIndex];
    if (skill.damage > 0 && skill.damage >= enemyHealth) {
        if (enemyHealth > skillEffects[0].damage) {
            recommendation = {
                skillIndex: 0,
                text: "일반 공격으로 조금씩 압박하자!",
            };
        } else {
            recommendation = {
                skillIndex: 2,
                text: "여유를 갖고 숨을 고르자!",
            };
        }
    }

    if (
        recommendation.skillIndex === 2
        && stamina >= player.maxStamina
        && enemyHealth > skillEffects[0].damage
    ) {
        recommendation = {
            skillIndex: 0,
            text: "일반 공격으로 조금씩 압박하자!",
        };
    }

    return {
        action: "skill",
        skillIndex: recommendation.skillIndex,
        text: recommendation.text,
    };
}
