import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import Markdown from 'react-markdown'

import CodeTab from '../tabs/code_tab';
import LogTab from '../tabs/log_tab';
import PlayerTab from '../tabs/player_tab';
import ApiTab from '../tabs/api_tab';
import LevelsTab from '../tabs/levels_tab';
import KeybindingsTab from '../tabs/keybindings_tab';
import AccountTab from '../tabs/account_tab';

import generalMarkdown from '../assets/general_tab.md?raw';
import newsMarkdown from '../assets/news_tab.md?raw';

const tabs = [
    { name: 'Code', component: <CodeTab /> },
    { name: 'Log', component: <LogTab /> },
    { name: 'Player', component: <PlayerTab /> },
    { name: 'News', component: <Markdown>{newsMarkdown}</Markdown> },
    { name: 'General', component: <Markdown>{generalMarkdown}</Markdown> },
    { name: 'Api', component: <ApiTab /> },
    { name: 'Levels', component: <LevelsTab /> },
    { name: 'Shortcuts', component: <KeybindingsTab /> },
    { name: 'Account', component: <AccountTab /> },
];

export default function TabPane() {
    return (
        <Tabs defaultActiveKey="Code" id="tab-pane" className="mt-3 mb-3" justify>
            {tabs.map(({ name, component }) => (
                <Tab key={name} eventKey={name} title={name}>
                    {component}
                </Tab>
            ))}
        </Tabs>
    );
}