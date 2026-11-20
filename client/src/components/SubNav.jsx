import { NavLink } from 'react-router-dom';

// Horizontal tab bar shared by the professional and admin areas. Scrolls on small screens.
export default function SubNav({ items, label }) {
  return (
    <nav aria-label={label} className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                isActive ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
