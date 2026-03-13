package app.mettle.runelite;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import javax.inject.Inject;
import javax.inject.Singleton;
import net.runelite.api.Client;
import net.runelite.api.Skill;
import net.runelite.api.vars.AccountType;

@Singleton
public class MettleSyncService
{
    private static final String FORMAT = "mettle-account-sync";
    private static final int VERSION = 1;
    private static final Pattern FILE_SAFE = Pattern.compile("[^a-z0-9]+");

    private final Client client;
    private final MettleSyncConfig config;
    private final BossSyncService bossSyncService;
    private final QuestSyncService questSyncService;
    private final AchievementDiarySyncService achievementDiarySyncService;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    @Inject
    public MettleSyncService(
        Client client,
        MettleSyncConfig config,
        BossSyncService bossSyncService,
        QuestSyncService questSyncService,
        AchievementDiarySyncService achievementDiarySyncService
    )
    {
        this.client = client;
        this.config = config;
        this.bossSyncService = bossSyncService;
        this.questSyncService = questSyncService;
        this.achievementDiarySyncService = achievementDiarySyncService;
    }

    public Path exportSnapshot() throws IOException
    {
        Map<String, Object> snapshot = buildSnapshot();
        Path exportDirectory = Paths.get(config.exportDirectory());
        Files.createDirectories(exportDirectory);
        Path exportPath = exportDirectory.resolve(fileSafeName(resolveRsn()) + "-mettle-account-sync.json");
        Files.writeString(exportPath, gson.toJson(snapshot), StandardCharsets.UTF_8);
        return exportPath;
    }

    public BufferedImage createNavigationIcon()
    {
        BufferedImage image = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setColor(new Color(18, 18, 18, 220));
        graphics.fillRoundRect(0, 0, 16, 16, 4, 4);
        graphics.setColor(new Color(212, 175, 55));
        graphics.drawRoundRect(0, 0, 15, 15, 4, 4);
        graphics.drawLine(4, 5, 12, 5);
        graphics.drawLine(4, 8, 12, 8);
        graphics.drawLine(4, 11, 9, 11);
        graphics.dispose();
        return image;
    }

    private Map<String, Object> buildSnapshot()
    {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("format", FORMAT);
        payload.put("version", VERSION);
        payload.put("source", "mettle-runelite-plugin");
        payload.put("syncedAt", Instant.now().toString());
        payload.put("player", buildPlayer());
        payload.put("skills", buildSkillSnapshot());
        payload.put("bosses", buildBossSnapshot());
        payload.put("quests", questSyncService.buildQuestSnapshot());
        payload.put("achievementDiaries", achievementDiarySyncService.buildDiarySnapshot());
        return payload;
    }

    private Map<String, Object> buildPlayer()
    {
        Map<String, Object> player = new LinkedHashMap<>();
        player.put("rsn", resolveRsn());
        AccountType accountType = client.getAccountType();
        player.put("accountType", accountType != null ? accountType.name() : "STANDARD");
        return player;
    }

    private Map<String, Object> buildSkillSnapshot()
    {
        Map<String, Object> skills = new LinkedHashMap<>();
        for (Skill skill : Skill.values())
        {
            String key = mettleSkillKey(skill);
            if (key == null)
            {
                continue;
            }
            skills.put(key, client.getRealSkillLevel(skill));
        }
        skills.putIfAbsent("sailing", 1);
        return skills;
    }

    private Map<String, Object> buildBossSnapshot()
    {
        return bossSyncService.buildBossSnapshot();
    }

    private String resolveRsn()
    {
        if (client.getLocalPlayer() == null || client.getLocalPlayer().getName() == null)
        {
            return "unknown-player";
        }
        return client.getLocalPlayer().getName();
    }

    private String fileSafeName(String value)
    {
        String normalized = FILE_SAFE.matcher(value.toLowerCase()).replaceAll("-").replaceAll("(^-+|-+$)", "");
        return normalized.isEmpty() ? "mettle-account" : normalized;
    }

    private String mettleSkillKey(Skill skill)
    {
        switch (skill)
        {
            case ATTACK:
                return "attack";
            case DEFENCE:
                return "defence";
            case STRENGTH:
                return "strength";
            case HITPOINTS:
                return "hitpoints";
            case RANGED:
                return "ranged";
            case PRAYER:
                return "prayer";
            case MAGIC:
                return "magic";
            case COOKING:
                return "cooking";
            case WOODCUTTING:
                return "woodcutting";
            case FLETCHING:
                return "fletching";
            case FISHING:
                return "fishing";
            case FIREMAKING:
                return "firemaking";
            case CRAFTING:
                return "crafting";
            case SMITHING:
                return "smithing";
            case MINING:
                return "mining";
            case HERBLORE:
                return "herblore";
            case AGILITY:
                return "agility";
            case THIEVING:
                return "thieving";
            case SLAYER:
                return "slayer";
            case FARMING:
                return "farming";
            case RUNECRAFT:
                return "runecrafting";
            case HUNTER:
                return "hunter";
            case CONSTRUCTION:
                return "construction";
            default:
                return null;
        }
    }
}
