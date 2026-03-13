package app.mettle.runelite;

import com.google.inject.Provides;
import java.io.IOException;
import javax.inject.Inject;
import net.runelite.api.GameState;
import net.runelite.api.events.GameStateChanged;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.ui.ClientToolbar;
import net.runelite.client.ui.NavigationButton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@PluginDescriptor(
    name = "Mettle Sync",
    description = "Exports a Mettle account sync snapshot with skills, bosses, quests, and achievement diaries",
    tags = {"mettle", "sync", "quests", "diaries"}
)
public class MettleSyncPlugin extends Plugin
{
    private static final Logger log = LoggerFactory.getLogger(MettleSyncPlugin.class);

    @Inject
    private ClientToolbar clientToolbar;

    @Inject
    private MettleSyncConfig config;

    @Inject
    private MettleSyncService syncService;

    @Inject
    private QuestSyncService questSyncService;

    @Inject
    private AchievementDiarySyncService achievementDiarySyncService;

    @Inject
    private BossSyncService bossSyncService;

    private NavigationButton navigationButton;
    private MettleSyncPanel panel;

    @Provides
    MettleSyncConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(MettleSyncConfig.class);
    }

    @Override
    protected void startUp()
    {
        panel = new MettleSyncPanel(syncService, questSyncService, achievementDiarySyncService, bossSyncService);
        navigationButton = NavigationButton.builder()
            .tooltip("Mettle Sync")
            .icon(syncService.createNavigationIcon())
            .priority(6)
            .panel(panel)
            .build();
        clientToolbar.addNavigation(navigationButton);
        log.info("Mettle Sync plugin started");
    }

    @Override
    protected void shutDown()
    {
        if (navigationButton != null)
        {
            clientToolbar.removeNavigation(navigationButton);
            navigationButton = null;
        }
        panel = null;
        log.info("Mettle Sync plugin stopped");
    }

    @Subscribe
    public void onGameStateChanged(GameStateChanged event)
    {
        if (!config.exportOnLogin() || event.getGameState() != GameState.LOGGED_IN)
        {
          return;
        }

        try
        {
            String exportPath = syncService.exportSnapshot().toString();
            if (panel != null)
            {
                panel.refreshSummary();
                panel.setStatus("Exported to " + exportPath);
            }
            log.info("Exported Mettle sync snapshot to {}", exportPath);
        }
        catch (IOException ex)
        {
            log.error("Failed to export Mettle sync snapshot", ex);
        }
    }

}
