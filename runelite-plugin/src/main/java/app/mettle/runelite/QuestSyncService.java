package app.mettle.runelite;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.inject.Inject;
import javax.inject.Singleton;
import net.runelite.api.Client;
import net.runelite.api.Quest;
import net.runelite.api.QuestState;

@Singleton
public class QuestSyncService
{
    private final Client client;

    @Inject
    public QuestSyncService(Client client)
    {
        this.client = client;
    }

    public Map<String, Object> buildQuestSnapshot()
    {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        List<String> completedQuestIds = new ArrayList<>();
        List<String> startedQuestIds = new ArrayList<>();

        for (Quest quest : Quest.values())
        {
            QuestState state = quest.getState(client);
            String questId = normalizeQuestName(quest.getName());

            if (state == QuestState.FINISHED)
            {
                completedQuestIds.add(questId);
            }
            else if (state == QuestState.IN_PROGRESS)
            {
                startedQuestIds.add(questId);
            }
        }

        snapshot.put("completedQuestIds", completedQuestIds);
        snapshot.put("startedQuestIds", startedQuestIds);
        // TODO: Resolve quest points from a client-backed source if available.
        snapshot.put("questCapeDetected", false);
        return snapshot;
    }

    public int completedQuestCount()
    {
        int count = 0;
        for (Quest quest : Quest.values())
        {
            if (quest.getState(client) == QuestState.FINISHED)
            {
                count++;
            }
        }
        return count;
    }

    public int startedQuestCount()
    {
        int count = 0;
        for (Quest quest : Quest.values())
        {
            if (quest.getState(client) == QuestState.IN_PROGRESS)
            {
                count++;
            }
        }
        return count;
    }

    private String normalizeQuestName(String value)
    {
        return value
            .trim()
            .toLowerCase()
            .replace("'", "")
            .replace("&", " and ")
            .replaceAll("[^a-z0-9]+", "_")
            .replaceAll("^_+|_+$", "");
    }
}
