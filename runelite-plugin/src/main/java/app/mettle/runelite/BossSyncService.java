package app.mettle.runelite;

import java.util.LinkedHashMap;
import java.util.Map;
import javax.inject.Singleton;

@Singleton
public class BossSyncService
{
    private static final String[] METTLE_BOSS_KEYS = {
        "abyssal_sire", "alchemical_hydra", "amoxliatl", "araxxor", "artio",
        "barrows_chests", "brutus", "bryophyta", "callisto", "calvarion",
        "cerberus", "chambers_of_xeric", "chambers_of_xeric_challenge_mode",
        "chaos_elemental", "chaos_fanatic", "commander_zilyana", "corporeal_beast",
        "crazy_archaeologist", "dagannoth_prime", "dagannoth_rex", "dagannoth_supreme",
        "deranged_archaeologist", "doom_of_mokhaiotl", "duke_sucellus", "general_graardor",
        "giant_mole", "grotesque_guardians", "hespori", "kalphite_queen",
        "king_black_dragon", "kraken", "kreearra", "kril_tsutsaroth", "lunar_chests",
        "mimic", "nex", "nightmare", "phosanis_nightmare", "obor", "phantom_muspah",
        "sarachnis", "scorpia", "scurrius", "shellbane_gryphon", "skotizo", "sol_heredit",
        "spindel", "tempoross", "the_corrupted_gauntlet", "the_gauntlet", "the_hueycoatl",
        "the_leviathan", "the_royal_titans", "the_whisperer", "theatre_of_blood",
        "theatre_of_blood_hard_mode", "thermonuclear_smoke_devil", "tombs_of_amascut",
        "tombs_of_amascut_expert", "tzkal_zuk", "tztok_jad", "vardorvis", "venenatis",
        "vetion", "vorkath", "wintertodt", "yama", "zalcano", "zulrah"
    };

    public Map<String, Object> buildBossSnapshot()
    {
        Map<String, Object> bosses = new LinkedHashMap<>();
        for (String bossKey : METTLE_BOSS_KEYS)
        {
            bosses.put(bossKey, 0);
        }
        return bosses;
    }

    public String sourceLabel()
    {
        return "Official HiScores (planned)";
    }
}
