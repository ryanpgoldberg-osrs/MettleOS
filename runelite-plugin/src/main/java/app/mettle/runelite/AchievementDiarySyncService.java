package app.mettle.runelite;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.inject.Inject;
import javax.inject.Singleton;
import net.runelite.api.Client;
import net.runelite.api.Varbits;

@Singleton
public class AchievementDiarySyncService
{
    private final Client client;

    @Inject
    public AchievementDiarySyncService(Client client)
    {
        this.client = client;
    }

    public Map<String, Object> buildDiarySnapshot()
    {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("completedTaskIds", List.of());
        snapshot.put("completedTierIds", completedTierIds());
        return snapshot;
    }

    public int completedTierCount()
    {
        return completedTierIds().size();
    }

    private List<String> completedTierIds()
    {
        List<String> completed = new ArrayList<>();
        for (DiaryTier diaryTier : DiaryTier.values())
        {
            if (client.getVarbitValue(diaryTier.varbitId) > 0)
            {
                completed.add(diaryTier.id);
            }
        }
        return completed;
    }

    private enum DiaryTier
    {
        ARDOUGNE_EASY("ardougne_easy", Varbits.DIARY_ARDOUGNE_EASY),
        ARDOUGNE_MEDIUM("ardougne_medium", Varbits.DIARY_ARDOUGNE_MEDIUM),
        ARDOUGNE_HARD("ardougne_hard", Varbits.DIARY_ARDOUGNE_HARD),
        ARDOUGNE_ELITE("ardougne_elite", Varbits.DIARY_ARDOUGNE_ELITE),
        DESERT_EASY("desert_easy", Varbits.DIARY_DESERT_EASY),
        DESERT_MEDIUM("desert_medium", Varbits.DIARY_DESERT_MEDIUM),
        DESERT_HARD("desert_hard", Varbits.DIARY_DESERT_HARD),
        DESERT_ELITE("desert_elite", Varbits.DIARY_DESERT_ELITE),
        FALADOR_EASY("falador_easy", Varbits.DIARY_FALADOR_EASY),
        FALADOR_MEDIUM("falador_medium", Varbits.DIARY_FALADOR_MEDIUM),
        FALADOR_HARD("falador_hard", Varbits.DIARY_FALADOR_HARD),
        FALADOR_ELITE("falador_elite", Varbits.DIARY_FALADOR_ELITE),
        FREMENNIK_EASY("fremennik_easy", Varbits.DIARY_FREMENNIK_EASY),
        FREMENNIK_MEDIUM("fremennik_medium", Varbits.DIARY_FREMENNIK_MEDIUM),
        FREMENNIK_HARD("fremennik_hard", Varbits.DIARY_FREMENNIK_HARD),
        FREMENNIK_ELITE("fremennik_elite", Varbits.DIARY_FREMENNIK_ELITE),
        KANDARIN_EASY("kandarin_easy", Varbits.DIARY_KANDARIN_EASY),
        KANDARIN_MEDIUM("kandarin_medium", Varbits.DIARY_KANDARIN_MEDIUM),
        KANDARIN_HARD("kandarin_hard", Varbits.DIARY_KANDARIN_HARD),
        KANDARIN_ELITE("kandarin_elite", Varbits.DIARY_KANDARIN_ELITE),
        KARAMJA_EASY("karamja_easy", Varbits.DIARY_KARAMJA_EASY),
        KARAMJA_MEDIUM("karamja_medium", Varbits.DIARY_KARAMJA_MEDIUM),
        KARAMJA_HARD("karamja_hard", Varbits.DIARY_KARAMJA_HARD),
        KARAMJA_ELITE("karamja_elite", Varbits.DIARY_KARAMJA_ELITE),
        KOUREND_EASY("kourend_easy", Varbits.DIARY_KOUREND_EASY),
        KOUREND_MEDIUM("kourend_medium", Varbits.DIARY_KOUREND_MEDIUM),
        KOUREND_HARD("kourend_hard", Varbits.DIARY_KOUREND_HARD),
        KOUREND_ELITE("kourend_elite", Varbits.DIARY_KOUREND_ELITE),
        LUMBRIDGE_EASY("lumbridge_easy", Varbits.DIARY_LUMBRIDGE_EASY),
        LUMBRIDGE_MEDIUM("lumbridge_medium", Varbits.DIARY_LUMBRIDGE_MEDIUM),
        LUMBRIDGE_HARD("lumbridge_hard", Varbits.DIARY_LUMBRIDGE_HARD),
        LUMBRIDGE_ELITE("lumbridge_elite", Varbits.DIARY_LUMBRIDGE_ELITE),
        MORYTANIA_EASY("morytania_easy", Varbits.DIARY_MORYTANIA_EASY),
        MORYTANIA_MEDIUM("morytania_medium", Varbits.DIARY_MORYTANIA_MEDIUM),
        MORYTANIA_HARD("morytania_hard", Varbits.DIARY_MORYTANIA_HARD),
        MORYTANIA_ELITE("morytania_elite", Varbits.DIARY_MORYTANIA_ELITE),
        VARROCK_EASY("varrock_easy", Varbits.DIARY_VARROCK_EASY),
        VARROCK_MEDIUM("varrock_medium", Varbits.DIARY_VARROCK_MEDIUM),
        VARROCK_HARD("varrock_hard", Varbits.DIARY_VARROCK_HARD),
        VARROCK_ELITE("varrock_elite", Varbits.DIARY_VARROCK_ELITE),
        WESTERN_EASY("western_easy", Varbits.DIARY_WESTERN_EASY),
        WESTERN_MEDIUM("western_medium", Varbits.DIARY_WESTERN_MEDIUM),
        WESTERN_HARD("western_hard", Varbits.DIARY_WESTERN_HARD),
        WESTERN_ELITE("western_elite", Varbits.DIARY_WESTERN_ELITE),
        WILDERNESS_EASY("wilderness_easy", Varbits.DIARY_WILDERNESS_EASY),
        WILDERNESS_MEDIUM("wilderness_medium", Varbits.DIARY_WILDERNESS_MEDIUM),
        WILDERNESS_HARD("wilderness_hard", Varbits.DIARY_WILDERNESS_HARD),
        WILDERNESS_ELITE("wilderness_elite", Varbits.DIARY_WILDERNESS_ELITE);

        private final String id;
        private final int varbitId;

        DiaryTier(String id, int varbitId)
        {
            this.id = id;
            this.varbitId = varbitId;
        }
    }
}
