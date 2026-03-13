package app.mettle.runelite;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.io.IOException;
import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import net.runelite.client.callback.ClientThread;
import net.runelite.client.ui.PluginPanel;

public class MettleSyncPanel extends PluginPanel
{
    private final ClientThread clientThread;
    private final MettleSyncService syncService;
    private final QuestSyncService questSyncService;
    private final AchievementDiarySyncService achievementDiarySyncService;
    private final BossSyncService bossSyncService;

    private final JLabel statusLabel = new JLabel("Ready");
    private final JLabel questLabel = new JLabel();
    private final JLabel diaryLabel = new JLabel();
    private final JLabel bossLabel = new JLabel();

    public MettleSyncPanel(
        ClientThread clientThread,
        MettleSyncService syncService,
        QuestSyncService questSyncService,
        AchievementDiarySyncService achievementDiarySyncService,
        BossSyncService bossSyncService
    )
    {
        this.clientThread = clientThread;
        this.syncService = syncService;
        this.questSyncService = questSyncService;
        this.achievementDiarySyncService = achievementDiarySyncService;
        this.bossSyncService = bossSyncService;

        setLayout(new BorderLayout());
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setOpaque(false);

        JLabel title = new JLabel("Mettle Sync");
        title.setAlignmentX(LEFT_ALIGNMENT);
        title.setBorder(BorderFactory.createEmptyBorder(0, 0, 8, 0));
        content.add(title);

        JLabel body = new JLabel("<html>Export a full Mettle account snapshot. The plugin is the source of truth for quests and diaries; boss KC is intended to come from official HiScores.</html>");
        body.setAlignmentX(LEFT_ALIGNMENT);
        body.setBorder(BorderFactory.createEmptyBorder(0, 0, 12, 0));
        content.add(body);

        JPanel stats = new JPanel(new GridLayout(0, 1, 0, 6));
        stats.setAlignmentX(LEFT_ALIGNMENT);
        stats.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(60, 60, 60)),
            BorderFactory.createEmptyBorder(10, 10, 10, 10)
        ));
        stats.add(questLabel);
        stats.add(diaryLabel);
        stats.add(bossLabel);
        content.add(stats);

        JButton exportButton = new JButton("Export snapshot");
        exportButton.setAlignmentX(LEFT_ALIGNMENT);
        exportButton.setMaximumSize(new Dimension(Integer.MAX_VALUE, exportButton.getPreferredSize().height));
        exportButton.setBorder(BorderFactory.createEmptyBorder(12, 0, 0, 0));
        exportButton.addActionListener(e -> exportSnapshot());
        content.add(exportButton);

        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
        statusLabel.setBorder(BorderFactory.createEmptyBorder(12, 0, 0, 0));
        content.add(statusLabel);

        add(content, BorderLayout.NORTH);
        refreshSummaryAsync();
    }

    public void refreshSummaryAsync()
    {
        clientThread.invokeLater(() ->
        {
            int completedQuests = questSyncService.completedQuestCount();
            int startedQuests = questSyncService.startedQuestCount();
            int completedDiaryTiers = achievementDiarySyncService.completedTierCount();
            String bossText = "Bosses: " + bossSyncService.sourceLabel();

            SwingUtilities.invokeLater(() ->
            {
                questLabel.setText("Quests: " + completedQuests + " complete, " + startedQuests + " in progress");
                diaryLabel.setText("Diaries: " + completedDiaryTiers + " completed tiers tracked");
                bossLabel.setText(bossText);
            });
        });
    }

    public void setStatus(String status)
    {
        SwingUtilities.invokeLater(() -> statusLabel.setText(status));
    }

    private void exportSnapshot()
    {
        setStatus("Exporting...");
        clientThread.invokeLater(() ->
        {
            try
            {
                String exportPath = syncService.exportSnapshot().toString();
                refreshSummaryAsync();
                setStatus("Exported to " + exportPath);
            }
            catch (IOException ex)
            {
                setStatus("Export failed: " + ex.getMessage());
            }
        });
    }
}
